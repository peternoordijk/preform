```sh
$ npm install preform
```

Create forms in React the easy way!

This library is still in beta. I will take the time to write some docs later. Basically the most important part of the api can be found with the example code below. Creating the library I focused on the following:

- Efficiency (no unnecessary render calls from react)
- Lightweight (less than 10kb)
- Stable (no mutable state or weird breaking changes)
- Using only React hooks, but with backwards compatibility using higher order components
- TypeScript support

Other libraries might have more features out of the box. With this library it's up to you to create your own components.

```jsx
import React, { useCallback } from "react";
import { render } from "react-dom";
import { asForm, useField, FormSettingsProvider } from "preform";
 
const SomeInputField = ({ field, initialValue, validator }) => {
  const { error, setValue, validate, value } = useField({
    field,
    initialValue,
    validator
  });
 
  return (
    <div>
      <input
        onChange={event => setValue(event.target.value)}
        onBlur={validate}
        value={value}
        type="text"
      />
      {error && <span>{error.message}</span>}
    </div>
  );
};
 
function App({ asSubmit, formState, setValue, validate }) {
  const onClickResetValue = useCallback(() => setValue('woop', 'something'), []);
  const onClickValidate = useCallback(() => validate(), []);

  return (
    <form
      className="App"
      onSubmit={asSubmit(values => console.log(JSON.stringify(values)))}
    >
      <SomeInputField
        field="Name"
        initialValue="Bla"
        validator={value => (value.length > 5 ? null : "error")}
      />
      <SomeInputField
        field="Othername"
        initialValue="Blo"
        validator={value => (value.length > 2 ? null : "error")}
      />
      <SomeInputField
        field="woop"
        initialValue="something"
        validator={value => (value.length > 2 ? null : "error")}
      />
      <button type="submit">Submit</button>
      <button type="button" onClick={onClickResetValue}>Set 3th Value</button>
      <button type="button" onClick={onClickValidate}>Validate</button>
      <p>{formState.dirty ? "dirty" : "pristine"}</p>
    </form>
  );
}
 
const AppWrapper = asForm(App);
 
const rootElement = document.getElementById("root");
render(
  <FormSettingsProvider settings={{
    onSubmitError(formState) {
      console.error(formState);
    }
  }}>
    <AppWrapper />
  </FormSettingsProvider>
, rootElement);
```
