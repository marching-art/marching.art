import React from 'react';

const LogoIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 65 65" className={className}>
      <g>
        <circle cx="0" cy="0" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="25" cy="0" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="50" cy="0" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="0" cy="25" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="25" cy="25" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="50" cy="25" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="0" cy="50" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="25" cy="50" r="4" className="fill-accent dark:fill-accent-dark"/>
        <circle cx="50" cy="50" r="4" className="fill-accent dark:fill-accent-dark"/>
        <path d="M 0 0 Q 50 0, 50 50" className="stroke-primary dark:stroke-primary-dark" strokeWidth="6" fill="none" strokeLinecap="round"/>
      </g>
    </svg>
);

export default LogoIcon;