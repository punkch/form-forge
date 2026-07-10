import { ref, type Ref } from 'vue'

export interface UseFilePick {
  /** True while a dragged file hovers the dropzone; drives the `.over` style. */
  dragOver: Ref<boolean>
  /** `change` handler for the `<input type="file">`. */
  onPick: (event: Event) => void
  /** `drop` handler for the dropzone. */
  onDrop: (event: DragEvent) => void
}

/**
 * Shared drag-and-drop / file-input handling for the import dialogs. Invokes
 * `onFile` with the first file from either a drop or the native picker, so the
 * two dialogs no longer clone this handling (its dropzone markup and styles
 * live alongside it in FileDropzone.vue).
 */
export const useFilePick = (onFile: (file: File) => void): UseFilePick => {
  const dragOver = ref(false)

  const onPick = (event: Event): void => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file !== undefined) onFile(file)
  }

  const onDrop = (event: DragEvent): void => {
    dragOver.value = false
    const file = event.dataTransfer?.files?.[0]
    if (file !== undefined) onFile(file)
  }

  return { dragOver, onPick, onDrop }
}
