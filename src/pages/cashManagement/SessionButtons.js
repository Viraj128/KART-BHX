// import React from 'react';

// function SessionButtons({ sessions, currentSession, onSelect, disabledSessions, onTransferFloats }) {
//   return (
//     <div className="session-buttons">
//       {sessions.map(session => (
//         <button
//           key={session}
//           disabled={disabledSessions.includes(session)}
//           className={session === currentSession ? 'active' : ''}
//           onClick={() => onSelect(session)}
//         >
//           {session.replace('_', ' ')}
//         </button>
        
//       ))}
//       <button onClick={onTransferFloats}>Transfer Floats</button>
//     </div>
//   );
// }

// export default SessionButtons;
