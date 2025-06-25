import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, where, documentId } from 'firebase/firestore';
import { db } from '../../firebase/config'; // Adjust the path to your firebaseConfig.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Consider creating a constants file for better maintainability
const COLLECTIONS = {
    WASTE_LOGS: 'wasteLogs',
    ITEMS: 'items',
};
const FIELDS = {
    TIMESTAMP: 'timestamp',
    ITEM_ID: 'itemId',
    ITEM_NAME: 'itemName',
    PRICE: 'price',
    TOTAL_WASTE: 'totalWaste',
    REASON: 'reason',
};

const TrackInventoryWaste = () => {
    const [selectedDate, setSelectedDate] = useState('');
    const [wasteData, setWasteData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Function to format date for input type="date"
    const formatDateForInput = (date) => {
        if (!date) return '';
        // More concise way using built-in methods
        return new Date(date).toISOString().split('T')[0];
    };

    // Set default date to today when component mounts
    useEffect(() => {
        const today = new Date();
        setSelectedDate(formatDateForInput(today));
    }, []);

    // Memoize fetchWasteData to prevent unnecessary re-creations
    const fetchWasteData = useCallback(async () => {
        if (!selectedDate) {
            setWasteData([]);
            return;
        }

        setLoading(true);
        setError(null);
        setWasteData([]);

        try {
            const wasteLogsCollectionRef = collection(db, COLLECTIONS.WASTE_LOGS);

            const startOfDayUtcMillis = Date.parse(selectedDate + 'T00:00:00.000Z');
            const endOfDayUtcExclusiveMillis = startOfDayUtcMillis + (24 * 60 * 60 * 1000);

            const startOfDayUtc = new Date(startOfDayUtcMillis);
            const endOfDayUtcExclusive = new Date(endOfDayUtcExclusiveMillis);

            const queryStartTimestampValue = startOfDayUtc.toISOString();
            const queryEndTimestampValue = endOfDayUtcExclusive.toISOString();

            console.log("Querying for wasteLogs between (ISO String - UTC):", queryStartTimestampValue, "and (exclusive UTC)", queryEndTimestampValue);

            const q = query(
                wasteLogsCollectionRef,
                where(FIELDS.TIMESTAMP, '>=', queryStartTimestampValue),
                where(FIELDS.TIMESTAMP, '<', queryEndTimestampValue)
            );

            const wasteLogsSnapshot = await getDocs(q);
            console.log("Number of wasteLogs found for selected date:", wasteLogsSnapshot.docs.length);

            if (wasteLogsSnapshot.docs.length === 0) {
                setLoading(false);
                return;
            }

            const uniqueWastedItemIds = new Set();
            const rawWasteItemsData = [];

            for (const wasteLogDoc of wasteLogsSnapshot.docs) {
                const wasteLogData = wasteLogDoc.data();
                const wasteLogTimestamp = new Date(wasteLogData[FIELDS.TIMESTAMP]);

                // Client-side check for robustness, though Firestore query should handle most
                if (wasteLogTimestamp < startOfDayUtc || wasteLogTimestamp >= endOfDayUtcExclusive) {
                    console.warn(`Waste log with ID "${wasteLogDoc.id}" has timestamp ${wasteLogTimestamp.toISOString()} which is outside the precise selected day (UTC). Skipping.`);
                    continue;
                }

                const wasteItemsSubcollectionRef = collection(db, COLLECTIONS.WASTE_LOGS, wasteLogDoc.id, 'wasteItems');
                const wasteItemsSnapshot = await getDocs(wasteItemsSubcollectionRef);

                wasteItemsSnapshot.forEach((wasteItemDoc) => {
                    const wasteItemData = wasteItemDoc.data();
                    const itemId = wasteItemData[FIELDS.ITEM_ID] && typeof wasteItemData[FIELDS.ITEM_ID] === 'object' && wasteItemData[FIELDS.ITEM_ID].id
                        ? wasteItemData[FIELDS.ITEM_ID].id
                        : wasteItemData[FIELDS.ITEM_ID];

                    if (itemId) {
                        uniqueWastedItemIds.add(itemId);
                        rawWasteItemsData.push({ ...wasteItemData, extractedItemId: itemId });
                    } else {
                        console.warn(`Waste item document ${wasteItemDoc.id} has no valid '${FIELDS.ITEM_ID}'. Skipping.`);
                    }
                });
            }

            const wastedItemDetailsMap = new Map();
            if (uniqueWastedItemIds.size > 0) {
                const itemIdsArray = Array.from(uniqueWastedItemIds);
                const itemsCollectionRef = collection(db, COLLECTIONS.ITEMS);

                const chunkSize = 10;
                for (let i = 0; i < itemIdsArray.length; i += chunkSize) {
                    const chunk = itemIdsArray.slice(i, i + chunkSize);
                    const itemsQuery = query(itemsCollectionRef, where(documentId(), 'in', chunk));
                    const itemsSnapshot = await getDocs(itemsQuery);
                    itemsSnapshot.forEach(doc => {
                        wastedItemDetailsMap.set(doc.id, {
                            itemName: doc.data()[FIELDS.ITEM_NAME] || doc.data().name || `Unknown Item (${doc.id})`,
                            price: doc.data()[FIELDS.PRICE] || 0
                        });
                    });
                }
            }

            const aggregatedWasteData = new Map();

            rawWasteItemsData.forEach(wasteItem => {
                const itemId = wasteItem.extractedItemId;
                const itemDetail = wastedItemDetailsMap.get(itemId);

                if (itemDetail) {
                    const itemName = itemDetail.itemName;
                    const unitPrice = itemDetail.price;
                    const totalWasteQuantity = wasteItem[FIELDS.TOTAL_WASTE] || 0;
                    const reason = wasteItem[FIELDS.REASON] || 'N/A';
                    const lossPerItem = unitPrice * totalWasteQuantity;

                    if (aggregatedWasteData.has(itemId)) {
                        const existingData = aggregatedWasteData.get(itemId);
                        existingData.wastePerItems += totalWasteQuantity;
                        existingData.lossPerItems += lossPerItem;
                        if (reason !== 'N/A' && !existingData.reason.includes(reason)) {
                            existingData.reason = existingData.reason === 'N/A' ? reason : `${existingData.reason}, ${reason}`;
                        }
                    } else {
                        aggregatedWasteData.set(itemId, {
                            item_id: itemId,
                            itemName: itemName,
                            unitPrice: unitPrice,
                            wastePerItems: totalWasteQuantity,
                            reason: reason,
                            lossPerItems: lossPerItem,
                        });
                    }
                } else {
                    console.warn(`Item with ID "${itemId}" found in wasteLogs but its details could not be fetched from 'items' collection. Adding with placeholder details.`);
                    if (!aggregatedWasteData.has(itemId)) {
                        aggregatedWasteData.set(itemId, {
                            item_id: itemId,
                            itemName: `Unknown (${itemId})`,
                            unitPrice: 'N/A',
                            wastePerItems: wasteItem[FIELDS.TOTAL_WASTE] || 0,
                            reason: wasteItem[FIELDS.REASON] || 'N/A',
                            lossPerItems: 'N/A',
                        });
                    } else {
                        const existingData = aggregatedWasteData.get(itemId);
                        existingData.wastePerItems += wasteItem[FIELDS.TOTAL_WASTE] || 0;
                        if (wasteItem[FIELDS.REASON] !== 'N/A' && !existingData.reason.includes(wasteItem[FIELDS.REASON])) {
                            existingData.reason = existingData.reason === 'N/A' ? wasteItem[FIELDS.REASON] : `${existingData.reason}, ${wasteItem[FIELDS.REASON]}`;
                        }
                    }
                }
            });

            setWasteData(Array.from(aggregatedWasteData.values()));
        } catch (err) {
            console.error("Error fetching waste data:", err);
            setError("Failed to fetch waste data. Please try again. " + err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    // Automatically fetch data when selectedDate changes
    useEffect(() => {
        fetchWasteData();
    }, [selectedDate, fetchWasteData]);

    const handleDownloadCSV = () => {
        if (wasteData.length === 0) {
            alert("No data to download.");
            return;
        }

        const headers = ["Item_id", "Items (name)", "Unit Price", "Waste per items", "Reason", "Loss per items"];
        const rows = wasteData.map(item => [
            item.item_id,
            item.itemName,
            item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== 'N/A' ? `£${item.unitPrice.toFixed(2)}` : 'N/A',
            item.wastePerItems,
            item.reason,
            item.lossPerItems !== undefined && item.lossPerItems !== null && item.lossPerItems !== 'N/A' ? `£${item.lossPerItems.toFixed(2)}` : 'N/A'
        ]);

        // Calculate totals for CSV
        const totalWasteItems = wasteData.reduce((sum, item) => sum + (item.wastePerItems || 0), 0);
        const totalLossPerItems = wasteData.reduce((sum, item) => sum + (typeof item.lossPerItems === 'number' ? item.lossPerItems : 0), 0);
        const uniqueItemCount = wasteData.length;

        rows.push([
            "Total",
            uniqueItemCount,
            "N/A",
            totalWasteItems,
            "N/A",
            `£${totalLossPerItems.toFixed(2)}`
        ]);

        let csvContent = headers.join(",") + "\n";
        rows.forEach(row => {
            csvContent += row.map(e => `"${e}"`).join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `waste_report_${selectedDate || 'all'}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const handleDownloadPDF = async () => {
        if (wasteData.length === 0) {
            alert("No data to download.");
            return;
        }

        setLoading(true); // Indicate loading for PDF generation

        try {
            const input = document.getElementById('printable-waste-report');
            if (!input) {
                throw new Error("Printable report container element not found for PDF generation.");
            }

            const canvas = await html2canvas(input, { scale: 2 }); // Scale up for better quality
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            // Add Title and Date
            pdf.setFontSize(18);
            pdf.text('Track Wasted Items Report', 105, 20, { align: 'center' }); // Centered title
            pdf.setFontSize(12);
            pdf.text(`Date: ${selectedDate}`, 10, 30); // Date on the left

            // Adjust position for image to account for title and date
            const contentStartY = 40; // Starting Y position for the image after title/date
            pdf.addImage(imgData, 'PNG', 0, contentStartY, imgWidth, imgHeight);
            heightLeft -= (pageHeight - contentStartY); // Adjust heightLeft

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`waste_report_${selectedDate || 'all'}.pdf`);
            alert("PDF downloaded successfully!");
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Failed to generate PDF. Please try again. " + error.message);
        } finally {
            setLoading(false); // End loading
        }
    };

    // Calculate totals for display
    const totalWasteItems = wasteData.reduce((sum, item) => sum + (item.wastePerItems || 0), 0);
    const totalLossPerItems = wasteData.reduce((sum, item) => sum + (typeof item.lossPerItems === 'number' ? item.lossPerItems : 0), 0);
    const uniqueItemCount = wasteData.length;

    return (
        <div id="waste-report-container" className="p-6 text-gray-800 w-full">
            <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Track Wasted Items</h2>

            <div className="bg-white p-2 rounded-lg shadow-md mb-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex items-center space-x-2">
                    <label htmlFor="selectDate" className="font-medium">Select Date:</label>
                    <input
                        type="date"
                        id="selectDate"
                        className="px-2 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchWasteData}
                        className={`
                            px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105
                            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}
                        `}
                        disabled={loading}
                    >
                        {loading ? 'Generating...' : 'Generate Report'}
                    </button>
                    <button
                        onClick={handleDownloadCSV}
                        className={`
                            px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out
                            ${wasteData.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'}
                        `}
                        disabled={wasteData.length === 0}
                    >
                        Download CSV
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className={`
                            px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out
                            ${wasteData.length === 0 || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'}
                        `}
                        disabled={wasteData.length === 0 || loading} // Disable during PDF generation too
                    >
                        {loading ? 'Preparing PDF...' : 'Download PDF'}
                    </button>
                </div>
            </div>

            {loading && <p className="text-center text-gray-600">Loading wasted items...</p>}
            {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

            {!loading && !error && wasteData.length === 0 && (
                <p className="p-4 text-center text-gray-500">No wasted items found for the selected date.</p>
            )}

            {!loading && !error && wasteData.length > 0 && (
                <div id="printable-waste-report" className="w-full"> {/* New ID for the printable section */}
                    <table id="waste-report-table" className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Item_id</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Items (name)</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Waste per items</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Loss per items</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {wasteData.map((item, index) => (
                                <tr key={index} className="even:bg-gray-50 hover:bg-gray-100">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.item_id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.itemName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.unitPrice !== 'N/A' ? `£${item.unitPrice.toFixed(2)}` : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.wastePerItems}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.reason}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.lossPerItems !== 'N/A' ? `£${item.lossPerItems.toFixed(2)}` : 'N/A'}</td>
                                </tr>
                            ))}
                            {/* Total Row */}
                            <tr className="bg-gray-200 font-bold">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{uniqueItemCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{totalWasteItems}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£{totalLossPerItems.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TrackInventoryWaste;