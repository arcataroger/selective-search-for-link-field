import type {ReactNode} from "react";

/**
 * Advanced option label formatter (not yet in use).
 *
 * @param params - Parameters for formatting the advanced option label.
 * @returns A ReactNode representing the formatted label.
 */
export const advancedOptionLabelFormatter = ({
  isValid = true,
  isDraft = false,
  itemLabel,
  modelLabel,
  itemId,
}: {
  isValid?: boolean;
  isDraft?: boolean;
  itemLabel: string;
  modelLabel: string;
  itemId: string;
}): ReactNode => {
  const hasStatus: boolean = isDraft || !isValid;

  return (
    <div className="BelongsToInput__option">
      {hasStatus && `(${!isValid ? "Invalid " : ""}${isDraft ? "Draft" : ""}) `}
      {itemLabel}
      {modelLabel && (
        <span className="BelongsToInput__item-id">
          {modelLabel}#{itemId}
        </span>
      )}
    </div>
  );
};
