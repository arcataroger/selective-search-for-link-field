import type {SwitchFieldOptions} from "../types";

/**
 * Formats options for the select field.
 *
 * @param params - Parameters for formatting the option.
 * @returns The formatted option.
 */
export const basicOptionFormatter = ({
  itemId,
  itemLabel,
  modelLabel,
  showItemIdWithModelLabel = false,
}: {
  itemId: string;
  itemLabel?: string;
  modelLabel?: string;
  showItemIdWithModelLabel?: boolean;
}): SwitchFieldOptions => {
  // Generate a label based on provided parameters.
  const label = (() => {
    if (itemLabel && modelLabel) {
      if (showItemIdWithModelLabel) {
        return `${itemLabel} (${modelLabel} #${itemId})`;
      }
      return `${itemLabel} (${modelLabel})`;
    }

    if (itemLabel && !modelLabel) {
      return itemLabel;
    }

    if (modelLabel && !itemLabel) {
      return `Record ${itemId} (${modelLabel})`;
    }

    return `Record ${itemId}`;
  })();

  return {
    label,
    value: itemId,
  };
};
