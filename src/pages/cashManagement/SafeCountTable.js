import React from 'react';

function SafeCountTable({ 
  denominations, 
  values,
  onChange,
  actualAmount,
  onActualChange,
  expectedAmount,
  variance,
  readOnly ,
  session // <-- Add this prop to know which session is active
}) {
return (
  <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Denomination
          </th>
          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Bags
          </th>
          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Loose Notes
          </th>
          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Value (£)
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-100">
        {denominations.map((denom, index) => (
          <tr key={denom.name} className="hover:bg-gray-50">
            <td className="px-6 py-4 text-sm font-medium text-gray-900">{denom.name}</td>
            {!(Number(denom.value) >= 5 && Number(denom.value) <= 50) ? (
            <td className="px-6 py-4 text-center">
              <input
                type="number"
                min="0"
                className="w-20 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                value={values[index]?.bags ?? 0}
                onChange={(e) => onChange(index, 'bags', e.target.value)}
                disabled={readOnly}
              />
            </td>):
            ( <td className="px-6 py-4 text-center text-gray-400">—</td> )}
            <td className="px-6 py-4 text-center">
              <input
                type="number"
                min="0"
                className="w-20 text-center border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                value={values[index]?.loose ?? 0}
                onChange={(e) => onChange(index, 'loose', e.target.value)}
                disabled={readOnly}
              />
            </td>
            <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
              {(values[index]?.value ?? 0).toFixed(2)}
            </td>
          </tr>
        ))}

        {/* Only show expected amount and variance if not change_receive */}
        {session !== 'change_receive' && (
          <>
            <tr className="bg-gray-100">
              <td colSpan="3" className="px-6 py-3 text-right font-semibold text-gray-700">
                Expected Amount (£)
              </td>
              <td className="px-6 py-3 text-right font-semibold text-gray-900">
                {(expectedAmount??0).toFixed(2)}
              </td>
            </tr>
          </>
        )}
        <tr className="bg-gray-100">
          <td colSpan="3" className="px-6 py-3 text-right font-semibold text-gray-700">
            Actual Amount (£)
          </td>
          <td className="px-6 py-3 text-right">
            <input
              type="number"
              min="0"
              className="w-28 text-right border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
              value={actualAmount}
              onChange={onActualChange}
              disabled={readOnly}
            />
          </td>
        </tr>
        {/* Only show variance if not change_receive */}
        {session !== 'change_receive' && (
          <tr className="bg-gray-100">
            <td colSpan="3" className="px-6 py-3 text-right font-semibold text-gray-700">
              Variance (£)
            </td>
            <td className="px-6 py-3 text-right font-semibold text-red-600">
              {(variance??0).toFixed(2)}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);
};

export default SafeCountTable;
