module.exports = {
  usePageContext: () => ({
    setPageContext: jest.fn(),
    pageContext: null,
  }),
};
