## ctc_decoder.py

from collections import defaultdict

import torch
import numpy as np
from scipy.special import logsumexp

NINF = -1 * float('inf')
DEFAULT_EMISSION_THRESHOLD = 0.01


def _reconstruct(labels, blank=0):
    """Merge repeated labels and remove blanks (standard CTC post-processing)."""
    new_labels = []
    previous = None
    for l in labels:
        if l != previous:
            new_labels.append(l)
            previous = l
    return [l for l in new_labels if l != blank]



def greedy_decode(emission_log_prob, blank=0, **kwargs):
    # emission_log_prob: (length, num_class)  — log probabilities
    labels_raw = np.argmax(emission_log_prob, axis=-1)   # (length,)
    max_log_probs = emission_log_prob[
        np.arange(len(labels_raw)), labels_raw
    ]  # log prob of chosen token at each step

    # Confidence: mean exp(log_prob) over non-blank timesteps
    non_blank_mask = labels_raw != blank
    if non_blank_mask.any():
        confidence = float(np.exp(max_log_probs[non_blank_mask]).mean())
    else:
        # All blanks → empty prediction, low confidence
        confidence = float(np.exp(max_log_probs).mean())

    labels = _reconstruct(labels_raw.tolist(), blank=blank)
    return labels, confidence



def beam_search_decode(emission_log_prob, blank=0, **kwargs):
    beam_size          = kwargs['beam_size']
    emission_threshold = kwargs.get('emission_threshold',
                                    np.log(DEFAULT_EMISSION_THRESHOLD))

    length, class_count = emission_log_prob.shape
    beams = [([], 0)]   # (prefix, accumulated_log_prob)

    for t in range(length):
        new_beams = []
        for prefix, accumulated_log_prob in beams:
            for c in range(class_count):
                log_prob = emission_log_prob[t, c]
                if log_prob < emission_threshold:
                    continue
                new_prefix       = prefix + [c]
                new_accu_log_prob = accumulated_log_prob + log_prob
                new_beams.append((new_prefix, new_accu_log_prob))

        new_beams.sort(key=lambda x: x[1], reverse=True)
        beams = new_beams[:beam_size]

    # Merge beams with same reconstructed label
    total_accu_log_prob = {}
    for prefix, accu_log_prob in beams:
        labels_key = tuple(_reconstruct(prefix, blank))
        total_accu_log_prob[labels_key] = logsumexp(
            [accu_log_prob, total_accu_log_prob.get(labels_key, NINF)]
        )

    labels_beams = sorted(total_accu_log_prob.items(),
                          key=lambda x: x[1], reverse=True)
    best_labels, best_log_prob = labels_beams[0]

    # Length-normalised confidence (avoids penalising longer strings)
    seq_len    = max(len(best_labels), 1)
    confidence = float(np.exp(best_log_prob / seq_len))
    confidence = min(confidence, 1.0)   # numerical safety clamp

    return list(best_labels), confidence



def prefix_beam_decode(emission_log_prob, blank=0, **kwargs):
    beam_size          = kwargs['beam_size']
    emission_threshold = kwargs.get('emission_threshold',
                                    np.log(DEFAULT_EMISSION_THRESHOLD))

    length, class_count = emission_log_prob.shape
    beams = [(tuple(), (0, NINF))]
    # each beam: (prefix, (log_prob_ending_with_blank, log_prob_ending_with_non_blank))

    for t in range(length):
        new_beams_dict = defaultdict(lambda: (NINF, NINF))

        for prefix, (lp_b, lp_nb) in beams:
            for c in range(class_count):
                log_prob = emission_log_prob[t, c]
                if log_prob < emission_threshold:
                    continue

                end_t = prefix[-1] if prefix else None
                new_lp_b, new_lp_nb = new_beams_dict[prefix]

                if c == blank:
                    new_beams_dict[prefix] = (
                        logsumexp([new_lp_b, lp_b + log_prob, lp_nb + log_prob]),
                        new_lp_nb
                    )
                    continue

                if c == end_t:
                    new_beams_dict[prefix] = (
                        new_lp_b,
                        logsumexp([new_lp_nb, lp_nb + log_prob])
                    )

                new_prefix = prefix + (c,)
                new_lp_b2, new_lp_nb2 = new_beams_dict[new_prefix]

                if c != end_t:
                    new_beams_dict[new_prefix] = (
                        new_lp_b2,
                        logsumexp([new_lp_nb2, lp_b + log_prob, lp_nb + log_prob])
                    )
                else:
                    new_beams_dict[new_prefix] = (
                        new_lp_b2,
                        logsumexp([new_lp_nb2, lp_b + log_prob])
                    )

        beams = sorted(new_beams_dict.items(),
                       key=lambda x: logsumexp(x[1]), reverse=True)
        beams = beams[:beam_size]

    best_prefix, (lp_b, lp_nb) = beams[0]
    best_log_prob = logsumexp([lp_b, lp_nb])
    labels        = list(best_prefix)

    seq_len    = max(len(labels), 1)
    confidence = float(np.exp(best_log_prob / seq_len))
    confidence = min(confidence, 1.0)

    return labels, confidence



def ctc_decode(log_probs, label2char=None, blank=0,
               method='beam_search', beam_size=10):
    """
    Decode CTC log-probabilities.

    Args:
        log_probs  : Tensor of shape (seq_len, batch, num_class)  — log softmax output
        label2char : Optional dict mapping label index → character
        blank      : Blank token index (default 0)
        method     : 'greedy' | 'beam_search' | 'prefix_beam_search'
        beam_size  : Beam width (used by beam methods)

    Returns:
        decoded_list    : list[list[int | str]]  — one decoded sequence per batch item
        confidence_list : list[float]            — confidence in [0, 1] per batch item
    """
    # (seq_len, batch, class) -> (batch, seq_len, class)
    emission_log_probs = np.transpose(log_probs.cpu().numpy(), (1, 0, 2))

    decoders = {
        'greedy':             greedy_decode,
        'beam_search':        beam_search_decode,
        'prefix_beam_search': prefix_beam_decode,
    }
    decoder = decoders[method]

    decoded_list    = []
    confidence_list = []

    for emission_log_prob in emission_log_probs:
        decoded, confidence = decoder(emission_log_prob, blank=blank, beam_size=beam_size)
        if label2char:
            decoded = [label2char[l] for l in decoded]
        decoded_list.append(decoded)
        confidence_list.append(confidence)

    return decoded_list, confidence_list