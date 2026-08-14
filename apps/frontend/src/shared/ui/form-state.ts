import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

const SUBMITTING: InjectionKey<Ref<boolean>> = Symbol('form-submitting')

/**
 * Locking every field while a form is in flight is the form's job, not each
 * field's: passing `disabled` down by hand is how one field gets forgotten and
 * stays editable while the request is away.
 */
export function provideFormSubmitting(submitting: Ref<boolean>): void {
  provide(SUBMITTING, submitting)
}

export function useFormSubmitting(): ComputedRef<boolean> {
  const submitting = inject(SUBMITTING, undefined)

  return computed(() => submitting?.value ?? false)
}
