import React from 'react';
import { Task } from '../types';
import { StatusIcon } from './icons';

interface TaskListProps {
  tasks: Task[];
}

export const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-3">Task Plan</h3>
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-4 p-2 bg-gray-900/50 rounded-md">
            <div className="flex-shrink-0">
                <StatusIcon status={task.status} />
            </div>
            <p className="text-sm text-gray-300">{task.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
