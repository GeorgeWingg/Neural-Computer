/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React from 'react';
import {AppDefinition} from '../types';

interface IconProps {
  app: AppDefinition;
  onInteract: () => void;
}

export const Icon: React.FC<IconProps> = ({app, onInteract}) => {
  return (
    <div
      className="w-28 h-32 flex flex-col items-center justify-start text-center m-2 p-2 cursor-pointer select-none rounded-lg transition-colors hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" // Increased w-24 h-28 to w-28 h-32
      onClick={onInteract}
      onKeyDown={(e) => e.key === 'Enter' && onInteract()}
      tabIndex={0}
      role="button"
      aria-label={`Open ${app.name}`}>
      <div className="text-6xl mb-2 drop-shadow-sm">{app.icon}</div>{' '}
      {/* Increased text-5xl to text-6xl */}
      <div className="text-sm text-gray-800 font-semibold break-words max-w-full leading-tight">
        {app.name}
      </div>
    </div>
  );
};
