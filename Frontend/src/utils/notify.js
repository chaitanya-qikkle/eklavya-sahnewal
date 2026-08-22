import Swal from 'sweetalert2'

const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  didOpen: (toastElement) => {
    toastElement.addEventListener('mouseenter', Swal.stopTimer)
    toastElement.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

export const notify = {
  success: (title, text) => toast.fire({ icon: 'success', title, text }),
  error: (title, text) => toast.fire({ icon: 'error', title, text }),
  info: (title, text) => toast.fire({ icon: 'info', title, text }),
  warning: (title, text) => toast.fire({ icon: 'warning', title, text }),
}

export async function confirmAction(options = {}) {
  const {
    title = 'Are you sure?',
    text = 'This action cannot be undone.',
    icon = 'warning',
    confirmButtonText = 'Yes',
    cancelButtonText = 'Cancel',
  } = options

  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: true,
  })

  return result.isConfirmed
}
