import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-surface-dark text-text-secondary-dark mt-auto">
      <div className="container mx-auto px-4 py-6 text-center">
        <p>&copy; {new Date().getFullYear()} marching.art - The Ultimate Fantasy Drum Corps Game.</p>
      </div>
    </footer>
  );
};

export default Footer;