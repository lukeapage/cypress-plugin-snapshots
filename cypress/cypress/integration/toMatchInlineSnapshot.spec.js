describe('toMatchInlineSnapshot', () => {
  it('toMatchInlineSnapshot - json', () => {
    const wrapped = cy.wrap({});
    wrapped.__proto__.toMatchInlineSnapshot = function() {
      let stack;
      try {
        throw new Error();
      } catch (e) {
        stack = e.stack;
      }
      console.log(stack);
      debugger;
    };
    const req = cy
      .request('/static/stub.json')
      .its('body')
      .toMatchInlineSnapshot();

    debugger;
  });
});
