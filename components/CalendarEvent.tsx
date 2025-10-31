import React from 'react';

export interface CalendarEventData {
  '@type': 'CalendarEvent';
  summary: string;
  description: string;
  start: string; // ISO 8601 format: YYYY-MM-DDTHH:mm:ss
  end: string;   // ISO 8601 format: YYYY-MM-DDTHH:mm:ss
  location: string;
}

interface CalendarEventProps {
  data: CalendarEventData;
}

// Helper to format date for display
const formatDisplayDate = (date: Date) => {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Helper to format time for display
const formatDisplayTime = (date: Date) => {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Helper to format date for .ics file (YYYYMMDDTHHmmssZ)
const formatIcsDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

const generateIcsContent = (event: CalendarEventData): string => {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI-Dev-Assistant//EN',
    'BEGIN:VEVENT',
    `UID:${new Date().getTime()}@aidev.assistant`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${event.summary}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return content;
};


export const CalendarEvent: React.FC<CalendarEventProps> = ({ data }) => {
  const startDate = new Date(data.start);
  const endDate = new Date(data.end);

  const icsContent = generateIcsContent(data);
  const icsDataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
      <h5 className="text-lg font-bold text-blue-300 mb-3">{data.summary}</h5>
      
      {data.description && (
          <p className="text-sm text-gray-300 mb-4">{data.description}</p>
      )}

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-200">{formatDisplayDate(startDate)}</span>
        </div>
        <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-200">{formatDisplayTime(startDate)} to {formatDisplayTime(endDate)}</span>
        </div>
        {data.location && (
            <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-200">{data.location}</span>
            </div>
        )}
      </div>

      <div className="mt-5">
        <a
          href={icsDataUri}
          download="event.ics"
          className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          Add to Calendar
        </a>
      </div>
    </div>
  );
};
