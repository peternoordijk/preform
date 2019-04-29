import React, {
  useCallback,
  useContext,
  useState,
  useRef,
  useMemo,
  useEffect,
  SyntheticEvent
} from "react";

interface FormErrors {
  [key: string]: Error;
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
  dirty: boolean;
  pristine: boolean;
  errors: FormErrors;
}

type AsSubmit = (
  callback: (values: FormValues) => any,
  resetPristine: boolean,
  shouldPreventDefault: boolean
) => (event?: SyntheticEvent) => void;

interface FormValidators {
  /**
   * If makePristine is set to true it will make pristine = true after validating without errors
   */
  validate: (makePristine: boolean) => Promise<FormState>;

  /**
   * This function validates an individual field without actually updating the state
   */
  validateField: (field: string, values: FormValues) => Promise<Error | null>;
  fieldValidators: FormFieldValidators;
  asSubmit: AsSubmit;
}

interface AsFormInjectedProps {
  formState: FormState;
  validate: (makePristine?: boolean) => Promise<FormState>;
  setValue: (field: string, value: any, keepPristine?: boolean) => void;
  asSubmit: AsSubmit;
}

interface UseFieldArgs<V> {
  validator?: FormFieldValidator;
  field: string;
  initialValue?: V;
}

type SetValue<V> = (value: V, keepPristine?: boolean) => void;

interface UseFieldResponse<V> {
  value: any;
  setValue: SetValue<V>;
  validate: () => void;
  error?: Error | null;
}

interface UseFormApiResponse {
  formState: FormState;
  validate: ValidateAll;
  setValue: SetFieldValue;
};

interface FormSettings {
  onSubmitError: (state: FormState) => any;
}

const FormSettingsContext = React.createContext<FormSettings|null>(null);

type ValidateAll = (makePristine?: boolean) => Promise<FormState>;
type SetFieldValue = (field: string, value: any, keepPristine?: boolean) => void;

type FormContextValue = [
  FormState,
  FormValidators,
  React.Dispatch<React.SetStateAction<FormState>>,
  ValidateAll,
  SetFieldValue
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
    dirty: false,
    pristine: true
  });

  const formSettings = useContext(FormSettingsContext);

  const validatorsRef = useRef<FormValidators>({
    fieldValidators: {},
    validateField: () => Promise.resolve(null),
    validate: () => Promise.resolve(state),
    asSubmit: () => () => {}
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
    validatorsRef.current.validate = async (makePristine: boolean) => {
      const immutableValues: FormValues = {
        ...state.values
      };
      setState(prevState => ({
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
        setState(prevState => ({
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
        setState(prevState => {
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
        }
        return newState;
      }
    };
  }, [state.values]);

  const asSubmit: AsSubmit = useCallback(
    (callback, makePristine = true, shouldPreventDefault = true) => async (
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
      const formState = await validatorsRef.current.validate(makePristine);
      if (formState.valid) {
        callback(formState.values);
      } else if (formSettings && formSettings.onSubmitError) {
        formSettings.onSubmitError(formState);
      }
    },
    [formSettings]
  );

  const validate: ValidateAll = useCallback(
    (makePristine: boolean = false) => validatorsRef.current.validate(makePristine),
    []
  );

  const setValue = useCallback(
    (field: string, value: any, keepPristine: boolean = false) => {
      setState(previousState => {
        const newState = {
          ...previousState,
          values: {
            ...previousState.values,
            [field]: value
          }
        };
        if (!keepPristine) {
          newState.dirty = true;
          newState.pristine = false;
        }
        return newState;
      });
    },
    []
  );

  const formContextValue: FormContextValue = useMemo((): FormContextValue => ([
    state, validatorsRef.current, setState, validate, setValue
  ]), [state, validatorsRef.current, setState, validate, setValue]);

  return (
    <FormContext.Provider value={formContextValue}>
      <Component asSubmit={asSubmit} formState={state} validate={validate} setValue={setValue} {...props} />
    </FormContext.Provider>
  );
};

export const useField: <V>(args: UseFieldArgs<V>) => UseFieldResponse<V> = ({
  validator,
  field,
  initialValue
}) => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useField was being called outside a form");
  }

  const [state, formValidators, setState] = ctx;

  const value = field in state.values ? state.values[field] : initialValue;
  const error = state.errors && state.errors[field];

  const setValue = useCallback(
    (value: any, keepPristine: boolean = false) => {
      setState(previousState => {
        const newState = {
          ...previousState,
          values: {
            ...previousState.values,
            [field]: value
          }
        };
        if (!keepPristine) {
          newState.dirty = true;
          newState.pristine = false;
        }
        return newState;
      });
    },
    [field]
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
      setState(previousState => {
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
      setState(previousState => ({
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
    if (field in state.values) {
      return () => {};
    }
    setValue(initialValue, true);

    return () => {
      setState(previousState => {
        const newValues = {
          ...previousState.values
        };
        delete newValues[field];
        const newErrors = {
          ...previousState.errors
        };
        delete newErrors[field];
        return {
          ...previousState,
          values: newValues,
          errors: newErrors
        };
      });
    };
  }, [field]);

  return {
    value,
    setValue,
    validate,
    error
  };
};

export const useFormState = () => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormState was being called outside a form");
  }

  const [state] = ctx;

  return state;
};

export const useFormApi = (): UseFormApiResponse => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormState was being called outside a form");
  }

  const [state,,, validate, setValue] = ctx;

  return {
    formState: state,
    validate,
    setValue
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
  settings: FormSettings|null
};

export const FormSettingsProvider = ({ settings, ...props }: FormSettingsProviderProps & object) => (
  <FormSettingsContext.Provider {...props} value={settings} />
)
