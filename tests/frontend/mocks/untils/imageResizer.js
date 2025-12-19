module.exports = {
  resizeImageTo128: jest.fn((file) => Promise.resolve({
    dataUrl: 'data:image/png;base64,test',
    originalDataUrl: 'data:image/png;base64,original',
  })),
};
