```sh
$ npm install preform
```

Create forms in React the easy way!

Creating this library I focused on the following:

- Efficiency (no unnecessary render calls from react)
- Lightweight (less than 10kb)
- Stability (no mutable state or weird breaking changes)
- Using only React hooks, but with backwards compatibility using higher order components
- TypeScript support

## The form context

When creating a form you should first wrap the container component in the `asForm` function. This creates a context within which the state of all form fields will live. 

```jsx
import React from 'react';
import { asForm } from "preform";

const MyFormComponent = (props) => (
  <div>
    <h1>This is my form!</h1>
  </div>
);

const MyForm = asForm(MyFormComponent);

export default MyForm;
```

It is possible to create multiple form contexts (components wrapped in `asForm`) in the same page. Child components will only have access to their most direct container.

## Creating an input field

Let's create a simple input field in which you can enter your email:

```jsx
import React from 'react';
import { asForm, useField } from "preform";

const MyForm = (props) => {
  const { setValue, value } = useField({
    field: "firstName"
  });
  return (
    <div>
      <h1>This is my form!</h1>
      <label for="firstName">First name</label>
      <br />
      <input
        id="firstName"
        type="text"
        value={value}
        onChange={event => setValue(event.target.value)}
      />
    </div>
  );
};

export default asForm(MyForm);
```

So what's going on here is that when calling `asForm(MyForm)` a state is being created. When calling `useField({ field: "firstName" })` we create an attribute inside that state labelled `"firstName"`. `useField` will then return `value` and `setValue` to use this particular attribute. If you call `useField({ field: "firstName" })` again inside `MyForm` it will return the same value as the one before. So you can think of the `field` as being the unique identifier of a form field.

Knowing that we'll probably create more than one input field it would be a good idea to make a seperate `Input` component from which will call `useField`.

```jsx
import React from 'react';
import { asForm, useField } from "preform";

const Input = (props) => {
  const { setValue, value } = useField({
    field: props.field,
    initialValue: props.initialValue
  });
  return (
    <div>
      <label for={props.field}>{props.label}</label>
      <br />
      <input
        id={props.field}
        type={props.type}
        value={value}
        onChange={event => setValue(event.target.value)}
      />
    </div>
  )
}

const MyForm = (props) => {
  return (
    <div>
      <h1>This is my form!</h1>
      <Input
        field="firstName"
        type="text"
        label="First name"
        initialValue="Mickey"
      />
      <Input
        field="lastName"
        type="text"
        label="Last name"
        initialValue="Mouse"
      />
    </div>
  );
};

export default asForm(MyForm);
```

You might notice `useField` can also take an `initialValue`.

## Validation

Now let's make sure the name which you enter doesn't contain any numbers. We can check this using the regex `/^[^\d]*$/.test('string value')`. Let's put this in a validator function.

```jsx
// value is the value of the field we want to validate. values is an object containing all values in the entire form
const validateName = (value, values) => /^[^\d]*$/.test(value) ? null : 'A name should not contain numbers';
```

A validator takes the value of the field and should return a falsy value if it's correct (null, undefined, '', false etc). It should return a string with a description of what went wrong if the value is invalid. The validator can also return a promise resolving or rejecting with these values. 

The validator can be used as an argument in `useField` along with the field. `useField` also returns a `validate` and `error` variable which are coupled to whatever value the validator returns.

```jsx
const { setValue, value, validate, error } = useField({
  field: "name",
  validator: validateName
});
```

`validate` can be called so that the current value of the field gets validated. If the field is invalid, `error` will be changed to an `Error` object with the result of `validator` as its message.

Let's use the code from our example to validate the first name and last name.

```jsx
import React from 'react';
import { asForm, useField } from "preform";

const validateName = (value, values) => /^[^\d]*$/.test(value) ? null : 'A name should not contain numbers';

const Input = (props) => {
  const { setValue, value, validate, error } = useField({
    field: props.field,
    initialValue: props.initialValue,
    validator: props.validator
  });
  return (
    <div>
      <label for={props.field}>{props.label}</label>
      <br />
      <input
        id={props.field}
        type={props.type}
        value={value}
        onChange={event => setValue(event.target.value)}
        onBlur={validate}
      />
      {error && (
        <i>{error.message}</i>
      )}
    </div>
  )
}

const MyForm = (props) => {
  return (
    <div>
      <h1>This is my form!</h1>
      <Input
        field="firstName"
        type="text"
        label="First name"
        initialValue="Mickey"
        validator={validateName}
      />
      <Input
        field="lastName"
        type="text"
        label="Last name"
        initialValue="Mouse"
        validator={validateName}
      />
    </div>
  );
};

export default asForm(MyForm);
```

Right now we're validating every field on its own (using `onBlur`). However, we can also instead choose to validate the whole form at a certain moment. For that we can use the `useFormApi` hook. 

## useFormApi

This hook also brings some variables with which can be used to influence the form state as a whole.

```jsx
import { useFormApi } from "preform";

// Somewhere inside a component:
const {
  validate,
  formState,
  setValue
} = useFormApi();
```

### validate

This function can be called at any time to validate all fields currently in the context. Each component which did a call to `useField` will be updated if needed. This function returns a promise which will resolve as the new `formState`.

### formState

The `formState` is an object with the following signature:

```jsx
{
  // values is a map in which all current field values are stored
  values: {
    field: value
  };
  // valid will be updated only after calling the validate function on the entire form.
  valid: boolean;
  // invalid is simply the opposite of the valid attribute
  invalid: boolean;
  // when calling validate on the entire form, it might be that one of the validators is returning a promise 
  // which takes a while to resolve or reject. During that time, loading will be true
  loading: boolean;
  // dirty means that setValue has never called (every field is still at its initial value)
  dirty: boolean;
  // pristine is simply the opposite of the dirty attribute
  pristine: boolean;
  // errors is a map in which all current errors are stored
  errors: {
    field: Error
  };
}
```

### setValue

This function can be called to set the value of one specific field. Useful if you want to do this from outside the component which called `useField` for that specific field.

```jsx
// In here, the field 'firstName' is given the value 'Minnie'
setValue("firstName", "Minnie");
```

Using the `useFormApi` we can create submit functionality in our example

```jsx
import React from 'react';
import { asForm, useField, useFormApi } from "preform";

const validateName = (value, values) => /^[^\d]*$/.test(value) ? null : 'A name should not contain numbers';

const Input = (props) => {...}

const MyForm = (props) => {
  const { validate } = useFormApi();

  // Check the useSubmit hook to write this callback more efficiently!
  const handleSubmit = async (event) => {
    // Prevent the page from reloading
    event.preventDefault();

    const formState = await validate();
    if (formState.valid) {
      // In here you might want to make an API call or something like that
      console.log(formState.values)
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>This is my form!</h1>
      <Input
        field="firstName"
        type="text"
        label="First name"
        initialValue="Mickey"
        validator={validateName}
      />
      <Input
        field="lastName"
        type="text"
        label="Last name"
        initialValue="Mouse"
        validator={validateName}
      />
      <input type="submit" />
    </form>
  );
};

export default asForm(MyForm);
```

## useSubmit

This function has almost the same signature as [useCallback](https://reactjs.org/docs/hooks-reference.html#usecallback), only it makes sure the form has been validated successfully before the callback is being called. So from our example above we can rewrite this:

```js
const handleSubmit = useCallback(async (event) => {
  // Prevent the page from reloading
  event.preventDefault();

  const formState = await validate();
  if (formState.valid) {
    // In here you might want to make an API call or something like that
    await request(formState.values);
    console.log('Done!');
  }
}, [request, validate]);
```

To this:

```js
const handleSubmit = useSubmit(async (values) => {
  // In here you might want to make an API call or something like that
  await request(values);
  console.log('Done!');
}, [request]);
```

## Extra functions

The functionality above requires a whole lot of boilerplate, and it might also be difficult to achieve using React class components. Therefore this library contains a couple of "shortcut" functions.

### asField

Instead of calling `useField` you might want to wrap your input field component in the `asField` wrapper.

```jsx
import { asField, useField } from "preform";

// Using useField:
const Input = (props) => {
  const { setValue, value, error, validate } = useField({
    field: props.field,
    initialValue: props.initialValue,
    validator: props.validator
  });
  return (
    <div>
      <input
        value={value}
        onChange={event => setValue(event.target.value)}
        onBlur={validate}
      />
      {error && (
        <i>{error.message}</i>
      )}
    </div>
  )
}

// Using asField:
const InputComponent = (props) => {
  return (
    <div>
      <input
        value={props.value}
        onChange={event => props.setValue(event.target.value)}
        onBlur={props.validate}
      />
      {props.error && (
        <i>{props.error.message}</i>
      )}
    </div>
  )
}
const Input = asField(InputComponent);

// Both versions can be used like this:

<Input
  field="myField"
  validator={myValidator}
  initialValue={myInitialValue}
/>
```

### asForm props and asSubmit

When calling `asForm(MyComponent)` it will also pass some variables to MyComponent's props so that you don't have to call `useFormApi`. These are `formState`, `validate` and `setValue`. Besides that MyComponent will also receive the prop `asSubmit`. This function has the following signature:

```jsx
const handleSubmit = asSubmit((values) => {
  // All fields of the form have been validated correctly when this code is being executed. Also
  // values will be provided with the current values of the form
})
```

Using `asSubmit` we can simplify our earlier version of the example a bit more:

```jsx
import React from 'react';
import { asForm, useField, useFormApi } from "preform";

const validateName = (value, values) => /^[^\d]*$/.test(value) ? null : 'A name should not contain numbers';

const Input = (props) => {...}

const MyForm = (props) => {
  const handleSubmit = props.asSubmit((values) => {
    console.log(values);
  });

  return (
    <form onSubmit={handleSubmit}>
      <h1>This is my form!</h1>
      <Input
        field="firstName"
        type="text"
        label="First name"
        initialValue="Mickey"
        validator={validateName}
      />
      <Input
        field="lastName"
        type="text"
        label="Last name"
        initialValue="Mouse"
        validator={validateName}
      />
      <input type="submit" />
    </form>
  );
};

export default asForm(MyForm);
```
