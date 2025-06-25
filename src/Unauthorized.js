// Unauthorized.js
import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-3xl font-bold text-red-600 mb-4">403 - Forbidden</h1>
        <p className="text-gray-600 mb-4">
          You don't have permission to access this resource
        </p>
        <Link 
          to="/" 
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          Return to Login
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;