import React from 'react';
import { Task, TaskStatus } from '../types';
import { StatusIcon } from './icons';

interface TaskListProps {
  tasks: Task[];
  completedOutputsCount: number;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, completedOutputsCount }) => {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-3">Task Plan</h3>
      <div className="bg-gray-800 rounded-lg p-4 space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="p-2 bg-gray-900/50 rounded-md">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                  <StatusIcon status={task.status} />
              </div>
              <p className="text-sm text-gray-300 flex-1">{task.description}</p>
            </div>
            {task.status === TaskStatus.IN_PROGRESS && completedOutputsCount > 0 && (
              <div className="mt-2 pl-9 text-xs text-blue-300/80 italic">
                Using context from {completedOutputsCount} previous task(s)...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};