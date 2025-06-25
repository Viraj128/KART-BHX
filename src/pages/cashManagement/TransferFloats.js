// // TransferFloats.js
// import React from 'react';

// const TransferFloats = ({ values, setValues, setShowTransferFloats }) => {
//   const handleChange = (index, event) => {
//     const updatedValues = [...values];
//     updatedValues[index].bags = parseInt(event.target.value) || 0;
//     updatedValues[index].value = updatedValues[index].bags * values[index].bagValue;
//     setValues(updatedValues);
//   };

//   const handleSubmit = () => {
//     // Handle float transfer (e.g., update the state or submit to Firebase)
//     alert('Floats transferred!');
//     setShowTransferFloats(false); // Optionally hide the table after transfer
//   };

//   return (
//     <div>
//       <h3>Transfer Floats</h3>
//       <table>
//         <thead>
//           <tr>
//             <th>Denomination</th>
//             <th>Bags</th>
//             <th>Value</th>
//           </tr>
//         </thead>
//         <tbody>
//           {values.map((denomination, index) => (
//             <tr key={index}>
//               <td>{denomination.name}</td>
//               <td>
//                 <input
//                   type="number"
//                   value={denomination.bags}
//                   onChange={(event) => handleChange(index, event)}
//                 />
//               </td>
//               <td>{denomination.value}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//       <button onClick={handleSubmit}>Transfer Floats</button>
//       <button onClick={handleCancelTransferFloats}>Back to Safe Count</button>
//     </div>
//   );
// };

// export default TransferFloats;





import React from 'react';

const TransferFloats = ({ transferValues, setTransferValues, setShowTransferFloats, handleSaveTransferFloats }) => {
  const handleChange = (index, event) => {
    const updatedValues = [...transferValues];
    updatedValues[index].loose = parseInt(event.target.value) || 0;
    const denominationValue = parseFloat(updatedValues[index].name.replace('£', ''));
    updatedValues[index].value = updatedValues[index].loose * denominationValue;
    setTransferValues(updatedValues);
  };

  const handleSubmit = () => {
    const hasValues = transferValues.some((denomination) => denomination.loose > 0);
    if (!hasValues) {
      alert('Please enter at least one denomination to transfer.');
      return;
    }
    handleSaveTransferFloats();
  };

  const handleCancelTransferFloats = () => {
    setShowTransferFloats(false);
  };

  return (
    <div>
      <h3 className="text-2xl font-bold text-purple-800 mb-4">Transfer Floats</h3>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-purple-100 text-purple-800">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold tracking-wide">Denomination</th>
              <th className="px-6 py-3 text-center text-sm font-semibold tracking-wide">Loose</th>
              <th className="px-6 py-3 text-right text-sm font-semibold tracking-wide">Value</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {transferValues.map((denomination, index) => (
              <tr key={denomination.name} className="hover:bg-purple-50 transition">
                <td className="px-6 py-4 text-sm text-gray-800">{denomination.name}</td>
                <td className="px-6 py-4 text-center">
                  {/* Use loose instead of bags */}
                  <input
                    type="number"
                    value={denomination.loose}
                    onChange={(event) => handleChange(index, event)}
                    className="w-24 text-center px-3 py-1 border border-gray-300 rounded-md focus:ring-purple-400 focus:border-purple-400"
                  />
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-800">£{denomination.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-6 space-x-4">
        <button
          className="py-2 px-8 bg-purple-700 text-white rounded-md font-semibold text-base hover:bg-purple-800 shadow-lg transition-all"
          onClick={handleSubmit}
        >
          Transfer Floats
        </button>
        <button
          className="py-2 px-8 bg-gray-500 text-white rounded-md font-semibold text-base hover:bg-gray-600 shadow-lg transition-all"
          onClick={handleCancelTransferFloats}
        >
          Back to Safe Count
        </button>
      </div>
    </div>
  );
};

export default TransferFloats;