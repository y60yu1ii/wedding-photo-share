export function compressImage(file: File, maxDimension: number = 1920, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2d context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Check for WebP support
      const isWebPSupported = canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
      const outputType = isWebPSupported ? "image/webp" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas compression returned null blob"));
          }
        },
        outputType,
        quality
      );
    };
    img.onerror = () => {
      reject(new Error("Failed to load image into element"));
    };
  });
}
