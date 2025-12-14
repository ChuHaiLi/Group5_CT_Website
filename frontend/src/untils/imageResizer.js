const TARGET_SIZE = 96; // smaller square keeps payloads light for vision APIs
const JPEG_QUALITY = 0.72;

export const resizeImageTo128 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const originalDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
        const scale = Math.min(
          TARGET_SIZE / img.width,
          TARGET_SIZE / img.height
        );
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const dx = (TARGET_SIZE - drawWidth) / 2;
        const dy = (TARGET_SIZE - drawHeight) / 2;
        ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
        const thumbnailDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
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
