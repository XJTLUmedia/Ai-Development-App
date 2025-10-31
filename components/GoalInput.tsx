import React from 'react';

interface GoalInputProps {
  goal: string;
  setGoal: (goal: string) => void;
  disabled: boolean;
}

export const GoalInput: React.FC<GoalInputProps> = ({ goal, setGoal, disabled }) => {
  return (
    <div>
      <label htmlFor="goal-input" className="block text-sm font-medium text-gray-300 mb-2">
        Primary Goal
      </label>
      <textarea
        id="goal-input"
        rows={3}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        disabled={disabled}
        placeholder="e.g., 'Refactor the authentication module to use JWT and add two-factor authentication.'"
        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 disabled:opacity-50"
      />
    </div>
  );
};