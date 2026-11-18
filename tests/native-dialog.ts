// jsdom does not implement the native top layer. Browser QA verifies the
// actual focus, pointer and Escape behavior.
export function installNativeDialogStub() {
  const prototype = HTMLDialogElement.prototype;
  if (typeof prototype.showModal === 'function') return () => {};

  Object.defineProperties(prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
        this.querySelector<HTMLElement>('[data-dialog-close]')?.focus();
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });

  return () => {
    Reflect.deleteProperty(prototype, 'showModal');
    Reflect.deleteProperty(prototype, 'close');
  };
}
