describe('toMatchInlineSnapshot', () => {
  it('toMatchInlineSnapshot - json', () => {
    cy
      .request('/static/stub.json')
      .its('body')
      .toMatchInlineSnapshot();
  });
});
