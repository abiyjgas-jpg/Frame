const MAX_BYTES = 5 * 1024 * 1024
const MAX_SIDE = 640 // logical px on a 1280×720 slide

/** Reads an image file into a data URL and a default on-slide size that keeps its aspect ratio. */
export async function readImageFile(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image`)
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 5 MB. Use a smaller image.`)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error(`Couldn't read ${file.name}`))
    r.readAsDataURL(file)
  })
  const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || MAX_SIDE, h: img.naturalHeight || MAX_SIDE / 2 })
    img.onerror = () => resolve({ w: MAX_SIDE, h: MAX_SIDE / 2 })
    img.src = dataUrl
  })
  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  return { dataUrl, width: Math.round(w * k), height: Math.round(h * k) }
}
