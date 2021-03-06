import React, {
  useCallback,
  useContext,
  useState,
  useRef,
  useMemo,
  useEffect,
  DependencyList,
  SyntheticEvent
} from "react";

interface FormErrors {
  [key: string]: Error;
}

interface DirtyFields {
  [key: string]: boolean;
}

interface FormValues {
  [key: string]: any;
}

type FormFieldValidatorResponse =
  | null
  | Error
  | void
  | Promise<null | string | Error | void>;

type FormFieldValidator = (
  value: any,
  values: FormValues
) => FormFieldValidatorResponse;

interface FormFieldValidators {
  [key: string]: FormFieldValidator | null;
}

interface FormState {
  values: FormValues;
  valid: boolean;
  invalid: boolean;
  loading: boolean;
  submitted: boolean;
  dirty: boolean;
  pristine: boolean;
  dirtyFields: DirtyFields;
  errors: FormErrors;
}

interface ValidateSettings {
  makeSubmitted?: boolean;
  makePristine?: boolean;
};

interface SubmitSettings extends ValidateSettings {
  shouldPreventDefault?: boolean;
};

type AsSubmit = (
  callback: (values: FormValues) => any,
  settings?: SubmitSettings
) => (event?: SyntheticEvent) => void;

type MakePristine = () => void;
type Reset = () => void;
type MakeSubmitted = () => void;

interface FormValidators {
  /**
   * If makePristine is set to true it will make pristine = true after validating without errors
   */
  validate: (settings?: ValidateSettings) => Promise<FormState>;

  /**
   * This function validates an individual field without actually updating the state
   */
  validateField: (field: string, values: FormValues) => Promise<Error | null>;
  fieldValidators: FormFieldValidators;
  asSubmit: AsSubmit;
}

interface SetValueSettings {
  keepPristine?: boolean
};

interface AsFormInjectedProps {
  formState: FormState;
  validate: (settings?: ValidateSettings) => Promise<FormState>;
  setValue: (field: string, value: any, settings?: SetValueSettings) => void;
  asSubmit: AsSubmit;
}

interface UseFieldArgs<V> {
  validator?: FormFieldValidator;
  field: string;
  initialValue?: V;
  forceInitialValue?: boolean
}

type SetValue<V> = (value: V, settings?: SetValueSettings) => void;
type SetValues = (values: {[key: string]: any}, settings?: SetValueSettings) => void;

interface UseFieldResponse<V> {
  value: any;
  setValue: SetValue<V>;
  validate: () => void;
  error?: Error | null;
  dirty: boolean;
  pristine: boolean;
  makePristine: MakePristine;
}

interface UseFormApiResponse {
  formState: FormState;
  validate: ValidateAll;
  setValue: SetFieldValue;
  setValues: SetValues;
  makePristine: MakePristine;
  reset: Reset;
};

interface FormSettings {
  onSubmitError: (state: FormState) => any;
}

const FormSettingsContext = React.createContext<FormSettings | null>(null);

type ValidateAll = (settings?: ValidateSettings) => Promise<FormState>;
type SetFieldValue = (field: string, value: any, settings?: SetValueSettings) => void;

type FormContextValue = [
  FormState,
  FormValidators,
  React.Dispatch<React.SetStateAction<FormState>>,
  ValidateAll,
  SetFieldValue,
  SetValues,
  MakePristine,
  MakeSubmitted,
  Reset
] | null;

const FormContext = React.createContext<FormContextValue>(null);

export const asForm = <P extends object>(
  Component: React.ComponentType<P & AsFormInjectedProps>
) => (props: P) => {
  const [state, setState] = useState<FormState>({
    values: {},
    valid: true,
    invalid: false,
    loading: false,
    errors: {},
    dirtyFields: {},
    dirty: false,
    submitted: true,
    pristine: true
  });

  const formSettings = useContext(FormSettingsContext);

  const validatorsRef = useRef<FormValidators>({
    fieldValidators: {},
    validateField: () => Promise.resolve(null),
    validate: () => Promise.resolve(state),
    asSubmit: () => () => { }
  });

  useEffect(() => {
    validatorsRef.current.validateField = async (field: string) => {
      const fieldValidator = validatorsRef.current.fieldValidators[field];
      if (!fieldValidator) {
        return null;
      }
      const error = await fieldValidator(state.values[field], state.values);
      if (!error) {
        return null;
      }
      return error instanceof Error ? error : new Error(error);
    };
    validatorsRef.current.validate = async ({ makePristine = false, makeSubmitted = false }: ValidateSettings = {}) => {
      const immutableValues: FormValues = {
        ...state.values
      };
      setState((prevState: FormState) => ({
        ...prevState,
        valid: true,
        invalid: false,
        loading: true,
        errors: {}
      }));

      const fieldValidations = Object.keys(state.values).map(async key => {
        try {
          const error = await validatorsRef.current.validateField(
            key,
            immutableValues
          );
          return error
            ? {
              key,
              error
            }
            : null;
        } catch (error) {
          return {
            key,
            error: error instanceof Error ? error : new Error(error)
          };
        }
      });

      const results: ({
        key: string;
        error: Error;
      } | null)[] = await Promise.all(fieldValidations);
      let hasErrors = false;
      const errors: FormErrors = {};

      results.forEach(result => {
        if (result) {
          hasErrors = true;
          errors[result.key] = result.error;
        }
      });

      if (hasErrors) {
        setState((prevState: FormState) => ({
          ...prevState,
          valid: false,
          invalid: true,
          loading: false,
          errors
        }));
        return {
          ...state,
          valid: false,
          invalid: true,
          loading: false,
          errors
        };
      } else {
        setState((prevState: FormState) => {
          const nextState = {
            ...prevState,
            valid: true,
            invalid: false,
            loading: false,
            errors: {}
          };
          if (makePristine) {
            nextState.pristine = true;
            nextState.dirty = false;
            nextState.dirtyFields = {};
            nextState.submitted = true;
          } else if (makeSubmitted) {
            nextState.submitted = true;
          }
          return nextState;
        });
        const newState = {
          ...state,
          valid: true,
          invalid: false,
          loading: false,
          errors: {}
        };
        if (makePristine) {
          newState.pristine = true;
          newState.dirty = false;
          newState.dirtyFields = {};
          newState.submitted = true;
        } else if (makeSubmitted) {
          newState.submitted = true;
        }
        return newState;
      }
    };
  }, [state.values]);

  const makeFormPristine = useCallback(
    () => {
      setState((previousState: FormState) => ({
        ...previousState,
        submitted: true,
        dirty: false,
        pristine: true,
        dirtyFields: {}
      }))
    },
    []
  );

  const reset = useCallback(
    () => {
      setState({
        values: {},
        valid: true,
        invalid: false,
        loading: false,
        errors: {},
        dirtyFields: {},
        dirty: false,
        submitted: true,
        pristine: true
      })
    },
    []
  );

  const makeFormSubmitted = useCallback(
    () => {
      setState((previousState: FormState) => ({
        ...previousState,
        submitted: true
      }))
    },
    []
  );

  const asSubmit: AsSubmit = useCallback(
    (callback: (values: FormValues) => any, { makePristine = false, shouldPreventDefault = true, makeSubmitted = true }: SubmitSettings = {}) => async (
      event?: SyntheticEvent
    ) => {
      if (event && shouldPreventDefault) {
        if (event.preventDefault) {
          event.preventDefault();
        }
        if (event.stopPropagation) {
          event.stopPropagation();
        }
      }
      const formState = await validatorsRef.current.validate();
      if (formState.valid) {
        await callback(formState.values);
        if (makePristine) {
          makeFormPristine();
        } else if (makeSubmitted) {
          makeFormSubmitted();
        }
      } else if (formSettings && formSettings.onSubmitError) {
        formSettings.onSubmitError(formState);
      }
    },
    [formSettings, makeFormPristine]
  );

  const validate: ValidateAll = useCallback(
    ({ makePristine = false, makeSubmitted = false }: ValidateSettings = {}) => validatorsRef.current.validate({ makePristine, makeSubmitted }),
    []
  );

  const setValues = useCallback(
    (fields: {[key:string]: any}, { keepPristine = false }: SetValueSettings = {}) => {
      const keys = Object.keys(fields);
      if (!keys.length) {
        return;
      }
      setState((previousState: FormState) => {
        const newState = {
          ...previousState,
          values: {
            ...previousState.values,
            ...fields
          }
        };
        if (!keepPristine) {
          newState.submitted = false;
          newState.dirty = true;
          newState.pristine = false;
          newState.dirtyFields = {
            ...previousState.dirtyFields,
          };
          keys.forEach(key => {
            newState.dirtyFields[key] = true;
          });
        }
        return newState;
      });
    },
    []
  );

  const setValue = useCallback(
    (field: string, value: any, { keepPristine = false }: SetValueSettings = {}) => {
      setState((previousState: FormState) => {
        const newState = {
          ...previousState,
          values: {
            ...previousState.values,
            [field]: value
          }
        };
        if (!keepPristine) {
          newState.submitted = false;
          newState.dirty = true;
          newState.pristine = false;
          newState.dirtyFields = {
            ...previousState.dirtyFields,
            [field]: true
          };
        }
        return newState;
      });
    },
    []
  );

  const formContextValue: FormContextValue = useMemo((): FormContextValue => ([
    state, validatorsRef.current, setState, validate, setValue, setValues, makeFormPristine, makeFormSubmitted, reset
  ]), [state, validatorsRef.current, setState, validate, setValue, setValues, makeFormPristine, makeFormSubmitted, reset]);

  return (
    <FormContext.Provider value={formContextValue}>
      <Component asSubmit={asSubmit} formState={state} validate={validate} setValue={setValue} makePristine={makeFormPristine} {...props} />
    </FormContext.Provider>
  );
};

const valueCanUpdateSafely = (val: any) => typeof val !== 'object' || val === null;

export const useField: <V>(args: UseFieldArgs<V>) => UseFieldResponse<V> = ({
  validator,
  field,
  forceInitialValue = false,
  initialValue
}) => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useField was being called outside a form");
  }

  const [state, formValidators, setState, , setFieldValue] = ctx;

  const value = field in state.values ? state.values[field] : initialValue;
  const error = state.errors && state.errors[field];
  const pristine = !state.dirtyFields[field];
  const dirty = !pristine;

  const setValue = useCallback(
    (value: any, settings: SetValueSettings = {}) => {
      setFieldValue(field, value, settings);
    },
    [field, setFieldValue]
  );

  useEffect(() => {
    formValidators.fieldValidators[field] = validator || null;

    return () => {
      delete formValidators.fieldValidators[field];
    };
  }, [validator, field, formValidators]);

  const validate = useCallback(async () => {
    const immutableValues: FormValues = {
      ...state.values
    };
    try {
      const error = await formValidators.validateField(field, immutableValues);
      setState((previousState: FormState) => {
        const newErrors: FormErrors = {
          ...previousState.errors
        };
        let valid;
        if (error) {
          newErrors[field] = error;
          valid = false;
        } else {
          delete newErrors[field];
          valid = !Object.keys(newErrors).length;
        }
        return {
          ...previousState,
          errors: newErrors,
          valid,
          invalid: !valid
        };
      });
    } catch (error) {
      setState((previousState: FormState) => ({
        ...previousState,
        errors: {
          ...previousState.errors,
          [field]: error
        },
        valid: false,
        invalid: true
      }));
    }
  }, [field, validator, formValidators]);

  useEffect(() => {
    if (!(field in state.values) || (
      pristine && state.values[field] !== initialValue
      // Prevent infinite loops
      && (
        forceInitialValue ||
        (
          valueCanUpdateSafely(state.values[field])
          && valueCanUpdateSafely(initialValue)
        )
      )
    )) {
      setValue(initialValue, { keepPristine: true });
    }
  }, [field, initialValue, pristine, forceInitialValue]);

  useEffect(() => {
    if (field in state.values) {
      return () => {};
    }

    return () => {
      setState((previousState: FormState) => {
        const newValues = {
          ...previousState.values
        };
        delete newValues[field];
        const newErrors = {
          ...previousState.errors
        };
        delete newErrors[field];
        const newDirtyFields = {
          ...previousState.dirtyFields
        };
        delete newDirtyFields[field];
        const newPristine = !Object.keys(newDirtyFields).length;
        return {
          ...previousState,
          pristine: newPristine,
          dirty: !newPristine,
          dirtyFields: newDirtyFields,
          values: newValues,
          errors: newErrors
        };
      });
    };
  }, [field]);

  const makePristine = useCallback(() => {
    setState((previousState: FormState) => {
      const newDirtyFields = {
        ...previousState.dirtyFields
      };
      delete newDirtyFields[field];
      const newPristine = !Object.keys(newDirtyFields).length;
      return {
        ...previousState,
        pristine: newPristine,
        dirty: !newPristine,
        dirtyFields: newDirtyFields
      };
    });
  }, [field]);

  return {
    value,
    setValue,
    validate,
    dirty,
    pristine,
    makePristine,
    error
  };
};

export const useFormState = () => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormState was called outside a form");
  }

  const [state] = ctx;

  return state;
};

export const useFormApi = (): UseFormApiResponse => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormApi was called outside a form");
  }

  const [state, , , validate, setValue, setValues, makePristine, reset] = ctx;

  return {
    formState: state,
    validate,
    setValue,
    setValues,
    makePristine,
    reset
  };
};

export const asField = <V, P extends UseFieldArgs<V>>(
  Component: React.ComponentType<P & UseFieldResponse<V>>
) => (props: P) => {
  const { field, validator, initialValue } = props;
  const useFieldResponse = useField({
    field,
    validator,
    initialValue
  });

  return <Component {...props} {...useFieldResponse} />;
};

interface FormSettingsProviderProps {
  settings: FormSettings | null
};

export const FormSettingsProvider = ({ settings, ...props }: FormSettingsProviderProps & object) => (
  <FormSettingsContext.Provider {...props} value={settings} />
)

export const useSubmit = <T extends (values: FormValues) => any>(callback: T, deps: DependencyList, { makePristine = false, shouldPreventDefault = true, makeSubmitted = true }: SubmitSettings = {}): (event?: SyntheticEvent) => Promise<void> => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useSubmit was called outside a form");
  }

  const [, , , validate,,, makeFormPristine, makeFormSubmitted] = ctx;
  const formSettings = useContext(FormSettingsContext);

  return useCallback(async (
    event?: SyntheticEvent
  ) => {
    if (event && shouldPreventDefault) {
      if (event.preventDefault) {
        event.preventDefault();
      }
      if (event.stopPropagation) {
        event.stopPropagation();
      }
    }
    const formState = await validate();
    if (formState.valid) {
      await callback(formState.values);
      if (makePristine) {
        makeFormPristine();
      } else if (makeSubmitted) {
        makeFormSubmitted();
      }
    } else if (formSettings && formSettings.onSubmitError) {
      formSettings.onSubmitError(formState);
    }
  }, [...deps, makePristine, shouldPreventDefault, validate, formSettings && formSettings.onSubmitError]);
};
