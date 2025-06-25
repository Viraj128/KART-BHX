import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';

// Helper function to parse the specific date string format
const parseKotDateString = (dateString) => {
    try {
        const match = dateString.match(/(\d{1,2}) (\w+) (\d{4}) at (\d{1,2}):(\d{1,2}):(\d{1,2}) UTC([+-]\d{1,2}:\d{2})/);

        if (!match) {
            console.warn("Date string format not recognized:", dateString);
            return null;
        }

        const [, day, monthStr, year, hour, minute, second, utcOffset] = match;

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIndex = monthNames.findIndex(name => monthStr.startsWith(name));

        if (monthIndex === -1) {
            console.warn("Unrecognized month string:", monthStr);
            return null;
        }

        const datePart = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
        const timePart = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
        const isoLikeString = `${datePart}T${timePart}${utcOffset}`;

        const parsedDate = new Date(isoLikeString);

        if (isNaN(parsedDate.getTime())) {
            console.warn("Failed to parse date string into a valid Date object:", dateString, "->", isoLikeString);
            return null;
        }
        return parsedDate;
    } catch (e) {
        console.error("Error during custom date string parsing:", dateString, e);
        return null;
    }
};

// Helper function to format time slots as "HH:MM AM/PM – HH:MM AM/PM"
const formatTimeSlot = (hour) => {
    let startDisplayHour = hour;
    let startPeriod = 'AM';
    if (startDisplayHour === 0) {
        startDisplayHour = 12;
        startPeriod = 'AM';
    } else if (startDisplayHour === 12) {
        startPeriod = 'PM';
    } else if (startDisplayHour > 12) {
        startDisplayHour -= 12;
        startPeriod = 'PM';
    }

    let endHour = hour + 1;
    let endDisplayHour = endHour;
    let endPeriod = 'AM';

    if (endDisplayHour === 24) {
        endDisplayHour = 12;
        endPeriod = 'AM';
    } else if (endDisplayHour === 12) {
        endPeriod = 'PM';
    } else if (endDisplayHour > 12) {
        endDisplayHour -= 12;
        endPeriod = 'PM';
    }

    const startFormatted = `${String(startDisplayHour).padStart(2, '0')}:01 ${startPeriod}`;
    const endFormatted = `${String(endDisplayHour).padStart(2, '0')}:00 ${endPeriod}`;

    return `${startFormatted} - ${endFormatted}`;
};

const HourlySalesDashboard = ({ selectedReport }) => {
    const { user, loading: authLoading } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const isManager = user?.role === ROLES.MANAGER;
    const canViewReport = isAdmin || isManager;

    const [hourlySalesData, setHourlySalesData] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalDaySales, setTotalDaySales] = useState(0);

    const fixedOutletId = "230525001";

    const totals = useMemo(() => {
        let totalCustomers = 0;
        let totalItems = 0;
        let totalQuantity = 0;
        let totalSalesNumeric = totalDaySales;

        hourlySalesData.forEach(row => {
            totalCustomers += row.customers;
            totalItems += row.items;
            totalQuantity += row.quantity;
        });

        const totalAvgSales = totalCustomers > 0 ? (totalSalesNumeric / totalCustomers) : 0;

        return {
            customers: totalCustomers,
            items: totalItems,
            quantity: totalQuantity,
            avgSales: `£${totalAvgSales.toFixed(2)}`,
            sales: `£${totalSalesNumeric.toFixed(2)}`,
            percentSales: '100.00%'
        };
    }, [hourlySalesData, totalDaySales]);

    const fetchHourlySalesData = useCallback(async () => {
        console.group("Fetch Hourly Sales Data");
        console.log("Fixed Outlet ID:", fixedOutletId);

        if (!fixedOutletId) {
            console.warn("Fixed Outlet ID not set, skipping data fetch.");
            setError("Fixed Outlet ID not set. Please check configuration.");
            setHourlySalesData([]);
            setTotalDaySales(0);
            console.groupEnd();
            return;
        }

        setLoading(true);
        setError(null);
        setHourlySalesData([]);
        setTotalDaySales(0);

        try {
            const year = parseInt(selectedDate.substring(0, 4));
            const month = parseInt(selectedDate.substring(5, 7)) - 1;
            const day = parseInt(selectedDate.substring(8, 10));

            const UTC_PLUS_530_MS_OFFSET = (5 * 60 + 30) * 60 * 1000;

            const startOfSelectedDayUTC = new Date(Date.UTC(year, month, day, 0, 0, 0));
            const filterStartUtcMillis = startOfSelectedDayUTC.getTime() - UTC_PLUS_530_MS_OFFSET;

            const endOfSelectedDayUTC = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
            const filterEndUtcMillis = endOfSelectedDayUTC.getTime() - UTC_PLUS_530_MS_OFFSET;

            console.log("Calculated filter range (UTC milliseconds for UTC+5:30 day):");
            console.log(`    Start of day (UTC+5:30 equivalent UTC): ${new Date(filterStartUtcMillis).toISOString()}`);
            console.log(`    End of day (UTC+5:30 equivalent UTC): ${new Date(filterEndUtcMillis).toISOString()}`);

            const kotCollectionPath = `KOT`;
            console.log("Firestore KOT Collection Path:", kotCollectionPath);
            const kotCollectionRef = collection(db, kotCollectionPath);
            const q = query(kotCollectionRef);

            const querySnapshot = await getDocs(q);
            console.log("Total KOT documents fetched from Firestore (before filtering):", querySnapshot.size);

            const rawData = [];
            let documentsProcessed = 0;
            let documentsFilteredIn = 0;

            querySnapshot.forEach((doc) => {
                documentsProcessed++;
                const data = doc.data();
                let transactionDate;

                if (data.date instanceof Timestamp) {
                    transactionDate = data.date.toDate();
                } else if (typeof data.date === 'string') {
                    transactionDate = parseKotDateString(data.date);
                    if (!transactionDate) {
                        console.warn(`[Doc ID: ${doc.id}] Skipping document due to unparseable date string:`, data.date);
                        return;
                    }
                } else {
                    console.warn(`[Doc ID: ${doc.id}] Skipping document due to unexpected 'date' format:`, data.date);
                    return;
                }

                const transactionTimeMs = transactionDate.getTime();

                if (transactionTimeMs >= filterStartUtcMillis && transactionTimeMs <= filterEndUtcMillis) {
                    rawData.push({ id: doc.id, ...data, date: transactionDate });
                    documentsFilteredIn++;
                }
            });

            console.log(`Total documents processed: ${documentsProcessed}`);
            console.log(`KOT documents matching selected date range (UTC+5:30 day): ${documentsFilteredIn}`);

            const aggregatedData = {};
            for (let hour = 0; hour < 24; hour++) {
                const displayTimeSlot = formatTimeSlot(hour);
                aggregatedData[displayTimeSlot] = {
                    customers: new Set(),
                    items: new Set(),
                    quantity: 0,
                    sales: 0
                };
            }

            let currentDayTotalSalesNumeric = 0;

            rawData.forEach(item => {
                const transactionUtcMillis = item.date.getTime();
                const transactionTimeInTargetTimezoneMillis = transactionUtcMillis + UTC_PLUS_530_MS_OFFSET;
                const dateInTargetTimezone = new Date(transactionTimeInTargetTimezoneMillis);

                const hourForAggregation = dateInTargetTimezone.getUTCHours();
                const displayTimeSlot = formatTimeSlot(hourForAggregation);

                if (aggregatedData[displayTimeSlot]) {
                    if (item.customerID) {
                        aggregatedData[displayTimeSlot].customers.add(item.customerID);
                    } else if (item.kot_id) {
                        aggregatedData[displayTimeSlot].customers.add(item.kot_id);
                    }

                    if (item.items && Array.isArray(item.items)) {
                        item.items.forEach(subItem => {
                            if (subItem.id) {
                                aggregatedData[displayTimeSlot].items.add(subItem.id);
                            } else if (subItem.name) {
                                aggregatedData[displayTimeSlot].items.add(subItem.name);
                            }
                            const parsedQuantity = parseFloat(subItem.quantity);
                            if (!isNaN(parsedQuantity)) {
                                aggregatedData[displayTimeSlot].quantity += parsedQuantity;
                            } else {
                                console.warn(`[Doc ID: ${item.id}] Invalid quantity for item '${subItem.id || subItem.name}':`, subItem.quantity);
                            }
                        });
                    }

                    const parsedAmount = parseFloat(item.amount);
                    if (!isNaN(parsedAmount)) {
                        aggregatedData[displayTimeSlot].sales += parsedAmount;
                        currentDayTotalSalesNumeric += parsedAmount;
                    } else {
                        console.warn(`[Doc ID: ${item.id}] Invalid sales amount:`, item.amount);
                    }
                }
            });

            setTotalDaySales(currentDayTotalSalesNumeric);

            const finalData = Object.keys(aggregatedData).map(time => {
                const data = aggregatedData[time];
                const customersCount = data.customers.size;
                const itemsCount = data.items.size;
                const totalSales = data.sales;

                const avgSales = customersCount > 0 ? (totalSales / customersCount) : 0;
                const percentSales = currentDayTotalSalesNumeric > 0 ? ((totalSales / currentDayTotalSalesNumeric) * 100) : 0;

                return {
                    time,
                    customers: customersCount,
                    items: itemsCount,
                    quantity: data.quantity,
                    avgSales: `£${avgSales.toFixed(2)}`,
                    sales: `£${totalSales.toFixed(2)}`,
                    percentSales: `${percentSales.toFixed(2)}%`
                };
            });

            finalData.sort((a, b) => {
                const parseHourFromTimeSlot = (timeStr) => {
                    const [start] = timeStr.split(' - ');
                    let hour = parseInt(start.split(':')[0]);
                    const ampm = start.includes('AM') ? 'AM' : 'PM';
                    if (ampm === 'PM' && hour !== 12) hour += 12;
                    if (ampm === 'AM' && hour === 12) hour = 0;
                    return hour;
                };
                return parseHourFromTimeSlot(a.time) - parseHourFromTimeSlot(b.time);
            });

            setHourlySalesData(finalData);

        } catch (err) {
            console.error("Error fetching hourly sales data:", err);
            setError(`Failed to fetch hourly sales data: ${err.message}. Check console for details.`);
        } finally {
            setLoading(false);
            console.groupEnd();
        }
    }, [selectedDate, selectedReport, fixedOutletId]);

    useEffect(() => {
        if (!authLoading && canViewReport && fixedOutletId && selectedReport === 'Hourly Sales by Trading Day') {
            fetchHourlySalesData();
        }
    }, [authLoading, canViewReport, selectedDate, selectedReport, fixedOutletId, fetchHourlySalesData]);

    const { jsPDF: LocalJsPDF } = window.jspdf || {};

    const downloadCsv = () => {
        if (hourlySalesData.length === 0 && totalDaySales === 0) {
            setError("No data to download.");
            return;
        }

        const headers = ["Time", "Customers", "Items", "Quantity", "Avg Sales", "Sales", "% Sales"];
        const rows = hourlySalesData.map(row => [
            row.time,
            row.customers,
            row.items,
            row.quantity,
            row.avgSales,
            row.sales,
            row.percentSales
        ]);

        rows.push([
            "Total",
            totals.customers,
            totals.items,
            totals.quantity,
            totals.avgSales,
            totals.sales,
            totals.percentSales
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `hourly_sales_report_${selectedDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadPdf = () => {
        if (hourlySalesData.length === 0 && totalDaySales === 0) {
            setError("No data to download.");
            return;
        }

        if (!LocalJsPDF) {
            console.error("jsPDF library not found globally (window.jspdf.jsPDF). Ensure it's loaded via script tag.");
            setError("PDF generation failed: jsPDF library not loaded correctly.");
            return;
        }

        const doc = new LocalJsPDF();
        if (typeof doc.autoTable !== 'function') {
            console.error("jspdf-autotable plugin not correctly attached. doc.autoTable is not a function.");
            setError("PDF generation failed: autoTable plugin not found.");
            return;
        }

        const tableColumn = ["Time", "Customers", "Items", "Quantity", "Avg Sales", "Sales", "% Sales"];
        const tableRows = hourlySalesData.map(row => [
            row.time,
            row.customers,
            row.items,
            row.quantity,
            row.avgSales,
            row.sales,
            row.percentSales
        ]);

        tableRows.push([
            "Total",
            totals.customers,
            totals.items,
            totals.quantity,
            totals.avgSales,
            totals.sales,
            totals.percentSales
        ]);

        try {
            doc.text(`Hourly Sales Report for ${selectedDate}`, 14, 15);
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 20,
                styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                didParseCell: function (data) {
                    if (data.row.index === tableRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [220, 220, 220];
                    }
                }
            });

            doc.save(`hourly_sales_report_${selectedDate}.pdf`);
            console.log("PDF download initiated successfully.");
        } catch (err) {
            console.error("Error during PDF generation or saving:", err);
            setError(`Failed to generate PDF: ${err.message}. Check console for details.`);
        }
    };

    if (authLoading) {
        return (
            <div className="p-4 bg-white rounded-lg shadow-md">
                <p className="text-blue-600 text-center py-4">Checking authentication...</p>
            </div>
        );
    }

    if (!canViewReport) {
        return (
            <div className="p-4 bg-white rounded-lg shadow-md">
                <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">
                    Access denied: Only managers and admins can view this report.
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 text-gray-800">
            <h2 className="text-2xl font-bold mb-4">Hourly Sales Report</h2>

            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-100 rounded-lg shadow-md">
                <div className="flex flex-col">
                    <label htmlFor="selectedDate" className="text-sm font-medium text-gray-700 mb-1">Select Date:</label>
                    <input
                        type="date"
                        id="selectedDate"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={fetchHourlySalesData}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 ease-in-out"
                    disabled={loading || !fixedOutletId}
                >
                    {loading ? 'Generating...' : 'Generate Report'}
                </button>
                <button
                    onClick={downloadCsv}
                    className="mt-6 px-6 py-2 bg-green-600 text-white font-semibold rounded-md shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-200 ease-in-out"
                    disabled={loading || (hourlySalesData.length === 0 && totalDaySales === 0)}
                >
                    Download CSV
                </button>
                <button
                    onClick={downloadPdf}
                    className="mt-6 px-6 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-200 ease-in-out"
                    disabled={loading || (hourlySalesData.length === 0 && totalDaySales === 0)}
                >
                    Download PDF
                </button>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-lg text-gray-600">Loading data...</div>
            ) : (
                <div className="overflow-x-auto rounded-lg shadow-lg">
                    <table className="min-w-full bg-white border border-gray-200">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider rounded-tl-lg">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customers</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Sales</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sales</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider rounded-tr-lg">% Sales</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {hourlySalesData.length > 0 || totalDaySales !== 0 ? (
                                <>
                                    {hourlySalesData.map((row, index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{row.time}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.customers}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.items}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.quantity}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.avgSales}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.sales}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.percentSales}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-200 font-bold text-gray-800">
                                        <td className="px-4 py-3 whitespace-nowrap">Total</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{totals.customers}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{totals.items}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{totals.quantity}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{totals.avgSales}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{totals.sales}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{totals.percentSales}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                        No data available for the selected date.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {hourlySalesData.length > 0 && (
                            <tfoot className="bg-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider rounded-bl-lg">Total</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">{totals.customers}</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">{totals.items}</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">{totals.quantity}</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">{totals.avgSales}</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">{totals.sales}</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider rounded-br-lg">100.00%</th>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </div>
    );
};

export default HourlySalesDashboard;