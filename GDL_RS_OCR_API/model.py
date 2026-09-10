## model.py

import torch.nn as nn


class CRNN(nn.Module):

    def __init__(self, img_channel, img_height, img_width, num_class,
                 map_to_seq_hidden=64, rnn_hidden=128, leaky_relu=True):
        super(CRNN, self).__init__()

        self.cnn, (output_channel, output_height, output_width) = \
            self._cnn_backbone(img_channel, img_height, img_width, leaky_relu)

        # FIX: output_channel * output_height must match actual CNN output.
        # At img_height=80: output_height = 80 // 16 - 1 = 4
        # So map_to_seq input = 512 * 4 = 2048
        self.map_to_seq = nn.Linear(output_channel * output_height, map_to_seq_hidden)

        # Bidirectional LSTMs for strong left+right context
        self.rnn1 = nn.LSTM(map_to_seq_hidden, rnn_hidden, bidirectional=True)
        self.rnn2 = nn.LSTM(2 * rnn_hidden, rnn_hidden, bidirectional=True)

        self.dense = nn.Linear(2 * rnn_hidden, num_class)

    def _cnn_backbone(self, img_channel, img_height, img_width, leaky_relu):
        assert img_height % 16 == 0, f"img_height must be divisible by 16, got {img_height}"
        assert img_width % 4 == 0,   f"img_width must be divisible by 4, got {img_width}"

        channels    = [img_channel, 64, 128, 256, 256, 512, 512, 512]
        kernel_sizes = [3, 3, 3, 3, 3, 3, 2]
        strides      = [1, 1, 1, 1, 1, 1, 1]
        paddings     = [1, 1, 1, 1, 1, 1, 0]

        cnn = nn.Sequential()

        def conv_relu(i, batch_norm=False):
            input_channel  = channels[i]
            output_channel = channels[i + 1]
            cnn.add_module(
                f'conv{i}',
                nn.Conv2d(input_channel, output_channel,
                          kernel_sizes[i], strides[i], paddings[i])
            )
            if batch_norm:
                cnn.add_module(f'batchnorm{i}', nn.BatchNorm2d(output_channel))
            relu = nn.LeakyReLU(0.2, inplace=True) if leaky_relu else nn.ReLU(inplace=True)
            cnn.add_module(f'relu{i}', relu)

        # (img_channel, 80, 400)
        conv_relu(0)
        cnn.add_module('pooling0', nn.MaxPool2d(kernel_size=2, stride=2))
        # (64, 40, 200)

        conv_relu(1)
        cnn.add_module('pooling1', nn.MaxPool2d(kernel_size=2, stride=2))
        # (128, 20, 100)

        conv_relu(2)
        conv_relu(3)
        cnn.add_module('pooling2', nn.MaxPool2d(kernel_size=(2, 1)))
        # (256, 10, 100)

        conv_relu(4, batch_norm=True)
        conv_relu(5, batch_norm=True)
        cnn.add_module('pooling3', nn.MaxPool2d(kernel_size=(2, 1)))
        # (512, 5, 100)

        conv_relu(6)
        # (512, 4, 99)  <- height = 80//16 - 1 = 4, width = 400//4 - 1 = 99

        output_channel = channels[-1]
        output_height  = img_height // 16 - 1   # 4  for img_height=80
        output_width   = img_width  //  4 - 1   # 99 for img_width=400
        return cnn, (output_channel, output_height, output_width)

    def forward(self, images):
        # images: (batch, channel, height, width)
        conv = self.cnn(images)                          # (B, 512, 4, 99)
        batch, channel, height, width = conv.size()

        conv = conv.view(batch, channel * height, width) # (B, 2048, 99)
        conv = conv.permute(2, 0, 1)                     # (99, B, 2048)
        seq  = self.map_to_seq(conv)                     # (99, B, map_to_seq_hidden)

        recurrent, _ = self.rnn1(seq)                    # (99, B, 2*rnn_hidden)
        recurrent, _ = self.rnn2(recurrent)              # (99, B, 2*rnn_hidden)

        output = self.dense(recurrent)                   # (99, B, num_class)
        return output  # (seq_len, batch, num_class)