/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useEffect, useState} from 'react';

interface ParametersPanelProps {
  currentLength: number;
  onUpdateHistoryLength: (newLength: number) => void; // Renamed for clarity
  onClosePanel: () => void;
  isStatefulnessEnabled: boolean;
  onSetStatefulness: (enabled: boolean) => void; // Changed to accept a boolean
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  currentLength,
  onUpdateHistoryLength,
  onClosePanel,
  isStatefulnessEnabled,
  onSetStatefulness,
}) => {
  // Local state for pending changes
  const [localHistoryLengthInput, setLocalHistoryLengthInput] =
    useState<string>(currentLength.toString());
  const [localStatefulnessChecked, setLocalStatefulnessChecked] =
    useState<boolean>(isStatefulnessEnabled);

  // Update local state if props change (e.g., panel re-opened)
  useEffect(() => {
    setLocalHistoryLengthInput(currentLength.toString());
  }, [currentLength]);

  useEffect(() => {
    setLocalStatefulnessChecked(isStatefulnessEnabled);
  }, [isStatefulnessEnabled]);

  const handleHistoryLengthInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setLocalHistoryLengthInput(event.target.value);
  };

  const handleStatefulnessCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setLocalStatefulnessChecked(event.target.checked);
  };

  const handleApplyParameters = () => {
    // Apply history length
    const newLength = parseInt(localHistoryLengthInput, 10);
    if (!isNaN(newLength) && newLength >= 0 && newLength <= 10) {
      onUpdateHistoryLength(newLength);
    } else {
      alert('Please enter a number between 0 and 10 for history length.');
      setLocalHistoryLengthInput(currentLength.toString()); // Revert local input to original prop on error
      return; // Do not proceed to close if there's an error
    }

    // Apply statefulness if it has changed
    if (localStatefulnessChecked !== isStatefulnessEnabled) {
      onSetStatefulness(localStatefulnessChecked);
    }

    onClosePanel(); // Close the panel after applying settings
  };

  const handleClose = () => {
    // Reset local state to reflect original props before closing, ensuring no pending changes carry over visually if panel is quickly reopened
    setLocalHistoryLengthInput(currentLength.toString());
    setLocalStatefulnessChecked(isStatefulnessEnabled);
    onClosePanel();
  };

  return (
    <div className="p-6 bg-gray-50 h-full flex flex-col items-start pt-8">
      {/* Interaction History Row */}
      <div className="w-full max-w-md mb-6">
        <div className="llm-row items-center">
          <label
            htmlFor="maxHistoryLengthInput"
            className="llm-label whitespace-nowrap mr-3 flex-shrink-0"
            style={{minWidth: '150px'}}>
            Max History Length:
          </label>
          <input
            type="number"
            id="maxHistoryLengthInput"
            value={localHistoryLengthInput}
            onChange={handleHistoryLengthInputChange}
            min="0"
            max="10"
            className="llm-input flex-grow"
            aria-describedby="historyLengthHelpText"
          />
        </div>
      </div>

      {/* Statefulness Row */}
      <div className="w-full max-w-md mb-4">
        <div className="llm-row items-center">
          <label
            htmlFor="statefulnessCheckbox"
            className="llm-label whitespace-nowrap mr-3 flex-shrink-0"
            style={{minWidth: '150px'}}>
            Enable Statefulness:
          </label>
          <input
            type="checkbox"
            id="statefulnessCheckbox"
            checked={localStatefulnessChecked}
            onChange={handleStatefulnessCheckboxChange}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            aria-describedby="statefulnessHelpText"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 w-full max-w-md flex justify-start gap-3">
        {' '}
        {/* Changed pt-2 to mt-6, justify-end to justify-start */}
        <button
          onClick={handleApplyParameters}
          className="llm-button"
          aria-label="Apply all parameter settings and close">
          Apply Parameters
        </button>
        <button
          onClick={handleClose}
          className="llm-button bg-gray-500 hover:bg-gray-600 active:bg-gray-700"
          aria-label="Close parameters panel without applying current changes">
          Close Parameters
        </button>
      </div>
    </div>
  );
};
