export const resizeImageTo128 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const originalDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);
        const scale = Math.min(size / img.width, size / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const dx = (size - drawWidth) / 2;
        const dy = (size - drawHeight) / 2;
        ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
        const thumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64 = thumbnailDataUrl.split(",")[1];
        resolve({
          dataUrl: thumbnailDataUrl,
          base64,
          originalDataUrl,
        });
      };
      img.onerror = reject;
      img.src = originalDataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
