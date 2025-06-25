import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { db } from '../../firebase/config';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';

function WeeklySalesDashboard() {
    const { user, loading: authLoading } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const isManager = user?.role === ROLES.MANAGER;
    const canViewReport = isAdmin || isManager;

    const componentRef = useRef(null);
    const filterControlsRef = useRef(null);

    const [salesData, setSalesData] = useState([]);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalSalesForRange, setTotalSalesForRange] = useState(0);

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const fetchSalesData = useCallback(async (startDt, endDt) => {
        console.log("fetchSalesData called with:", { startDt, endDt });

        setLoading(true);
        setError(null);
        let currentTotalSalesForRange = 0;

        try {
            const KOTCollectionRef = collection(db, 'KOT');
            console.log("Firestore collection path:", 'KOT');

            const q = query(KOTCollectionRef);
            console.log("Attempting to get documents from Firestore...");
            const querySnapshot = await getDocs(q);
            console.log("Successfully retrieved query snapshot from Firestore. Number of KOT documents found:", querySnapshot.size);

            const dailyAggregates = {};
            const dayCountsInPeriod = {};

            dayOrder.forEach(day => {
                dailyAggregates[day] = {
                    totalSales: 0,
                    totalCustomers: 0,
                    totalQuantity: 0,
                    uniqueCustomerIDs: new Set()
                };
                dayCountsInPeriod[day] = 0;
            });

            const parsedStartDate = new Date(startDt);
            parsedStartDate.setHours(0, 0, 0, 0);
            const parsedEndDate = new Date(endDt);
            parsedEndDate.setHours(23, 59, 59, 999);

            let currentDateIterator = new Date(parsedStartDate);
            while (currentDateIterator <= parsedEndDate) {
                const dayOfWeekIndex = currentDateIterator.getDay();
                const dayName = dayOrder[dayOfWeekIndex === 0 ? 6 : dayOfWeekIndex - 1];
                dayCountsInPeriod[dayName]++;
                currentDateIterator.setDate(currentDateIterator.getDate() + 1);
            }
            console.log("Day counts within the selected period:", dayCountsInPeriod);

            let processedKOTs = 0;
            querySnapshot.forEach((doc) => {
                const kot = doc.data();
                let parsedKotDate;

                console.groupCollapsed(`Processing KOT ID: ${doc.id}`);
                console.log("Raw KOT data:", kot);

                if (kot.date && typeof kot.date.toDate === 'function') {
                    parsedKotDate = kot.date.toDate();
                    console.log("Date parsed as Firestore Timestamp:", parsedKotDate);
                } else if (typeof kot.date === 'string') {
                    const dateParts = kot.date.match(/(\d{1,2}) (\w+) (\d{4}) at (\d{1,2}):(\d{1,2}):(\d{1,2}) UTC([+-]\d{1,2}:\d{1,2})/);
                    if (dateParts) {
                        const [_, day, monthName, yearStr, hour, minute, second] = dateParts;
                        const monthIndex = new Date(Date.parse(monthName + " 1, 2000")).getMonth();
                        const kotYear = parseInt(yearStr);
                        parsedKotDate = new Date(kotYear, monthIndex, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
                        console.log("Date parsed as string:", parsedKotDate);
                    } else {
                        parsedKotDate = new Date(kot.date);
                        if (isNaN(parsedKotDate.getTime())) {
                            console.warn(`Date string format not recognized and generic parse failed for KOT ID: ${doc.id}, raw date: "${kot.date}"`);
                        } else {
                            console.log("Date parsed as generic string:", parsedKotDate);
                        }
                    }
                } else {
                    console.warn(`KOT ID: ${doc.id} has unexpected date type: ${typeof kot.date}. Raw date:`, kot.date);
                }

                if (!parsedKotDate || isNaN(parsedKotDate.getTime())) {
                    console.warn(`Skipping KOT ID: ${doc.id} due to invalid or unparseable date.`);
                    console.groupEnd();
                    return;
                }

                if (parsedKotDate < parsedStartDate || parsedKotDate > parsedEndDate) {
                    console.log(`Skipping KOT ID: ${doc.id} because its date (${parsedKotDate.toISOString()}) is outside selected range (${parsedStartDate.toISOString()} - ${parsedEndDate.toISOString()}).`);
                    console.groupEnd();
                    return;
                }
                console.log(`KOT ID: ${doc.id} date (${parsedKotDate.toISOString()}) is within selected range.`);

                const dayOfWeekIndex = parsedKotDate.getDay();
                const dayName = dayOrder[dayOfWeekIndex === 0 ? 6 : dayOfWeekIndex - 1];

                const saleAmount = parseFloat(kot.amount) || 0;
                console.log(`KOT ID: ${doc.id}, Using saleAmount from kot.amount: ${saleAmount}`);

                let totalQuantityForKOT = 0;
                if (kot.items && Array.isArray(kot.items)) {
                    kot.items.forEach(item => {
                        const itemQuantity = parseInt(item.quantity) || 0;
                        totalQuantityForKOT += itemQuantity;
                    });
                    console.log(`KOT ID: ${doc.id}, Calculated totalQuantity from items: ${totalQuantityForKOT}`);
                } else {
                    console.warn(`KOT ID: ${doc.id} has no 'items' array or it's not an array. Total quantity for KOT will be 0.`);
                }

                if (isNaN(saleAmount)) {
                    console.warn(`Skipping KOT ID: ${doc.id} because calculated saleAmount is invalid (NaN).`);
                    console.groupEnd();
                    return;
                }

                dailyAggregates[dayName].totalSales += saleAmount;
                currentTotalSalesForRange += saleAmount;
                dailyAggregates[dayName].totalCustomers++;
                dailyAggregates[dayName].totalQuantity += totalQuantityForKOT;

                if (kot.customerID) {
                    dailyAggregates[dayName].uniqueCustomerIDs.add(kot.customerID);
                }

                processedKOTs++;
                console.groupEnd();
            });
            console.log("Total KOTs processed after filtering and validation:", processedKOTs);

            const formattedSalesData = dayOrder.map(day => {
                const data = dailyAggregates[day];
                const totalSales = data.totalSales;
                const numDaysInPeriod = dayCountsInPeriod[day];

                const avgSalesPcustomer = data.totalCustomers > 0 ? (totalSales / data.totalCustomers).toFixed(2) : '0.00';
                const avgSalesPerDay = numDaysInPeriod > 0 ? (totalSales / numDaysInPeriod).toFixed(2) : '0.00';
                const percentageSales = currentTotalSalesForRange > 0 ? ((totalSales / currentTotalSalesForRange) * 100).toFixed(2) : '0.00';

                return {
                    Month: day,
                    day: numDaysInPeriod,
                    Customers: data.totalCustomers,
                    Quantity: data.totalQuantity,
                    AvgSalesPcustomer: avgSalesPcustomer,
                    AvgSalesPerDay: avgSalesPerDay,
                    Sales: totalSales.toFixed(2),
                    PercentageSales: percentageSales,
                };
            });

            setSalesData(formattedSalesData);
            setTotalSalesForRange(currentTotalSalesForRange);
            console.log("Final sales data processed and set:", formattedSalesData);

        } catch (err) {
            console.error("Caught an error during KOT data processing/fetching:", err);
            setError(`Failed to load sales data: ${err.message}. Please check your console for details.`);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (!authLoading && canViewReport) {
            fetchSalesData(startDate, endDate);
        }
    }, [authLoading, canViewReport, startDate, endDate, fetchSalesData]);

    const handleStartDateChange = (event) => {
        setStartDate(event.target.value);
    };

    const handleEndDateChange = (event) => {
        setEndDate(event.target.value);
    };

    const handleGenerateReport = () => {
        console.log("Generate Report button clicked.");
        fetchSalesData(startDate, endDate);
    };

    const handleDownloadCSV = () => {
        if (salesData.length === 0) {
            console.log("No data to download.");
            return;
        }

        let csvContent = "Day of Week,Days in Period,Total Customers,Total Quantity,Avg Sales p/Customer,Avg Sales per Day,Total Sales,% of Total Sales\n";
        salesData.forEach(row => {
            csvContent += `${row.Month},${row.day},${row.Customers},${row.Quantity},${row.AvgSalesPcustomer},${row.AvgSalesPerDay},${row.Sales},${row.PercentageSales}%\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `weekly_sales_dashboard_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = async () => {
        const input = componentRef.current;
        const filterControls = filterControlsRef.current;

        if (!input) {
            console.error("Component ref is not attached to any element.");
            return;
        }

        console.log("Attempting to generate PDF...");
        setLoading(true);

        try {
            if (filterControls) {
                filterControls.style.display = 'none';
            }

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                windowWidth: input.scrollWidth,
                windowHeight: input.scrollHeight,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');

            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`weekly_sales_dashboard_${startDate}_to_${endDate}.pdf`);
            console.log("PDF generated successfully.");
        } catch (error) {
            console.error("Error generating PDF:", error);
            setError(`Failed to generate PDF: ${error.message}`);
        } finally {
            if (filterControls) {
                filterControls.style.display = 'flex';
            }
            setLoading(false);
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
        <div ref={componentRef} className="weekly-sales-dashboard p-6 bg-white rounded-lg shadow-md max-w-full overflow-hidden font-sans">
            <h2 className="text-2xl font-bold mb-4">Weekly Sales Report</h2>
            
            <div ref={filterControlsRef} className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 p-4 bg-gray-100 rounded-lg shadow-inner">
                <div className="flex flex-wrap items-center gap-4">
                    <label htmlFor="start-date" className="font-semibold text-gray-700 text-lg">Start Date:</label>
                    <input
                        type="date"
                        id="start-date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <label htmlFor="end-date" className="font-semibold text-gray-700 text-lg">End Date:</label>
                    <input
                        type="date"
                        id="end-date"
                        value={endDate}
                        onChange={handleEndDateChange}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <div className="flex flex-wrap justify-center sm:justify-end gap-3">
                    <button
                        onClick={handleGenerateReport}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 ease-in-out shadow-md transform hover:scale-105"
                    >
                        Generate Report
                    </button>
                    <button
                        onClick={handleDownloadCSV}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 ease-in-out shadow-md transform hover:scale-105"
                    >
                        Download CSV
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 ease-in-out shadow-md transform hover:scale-105"
                    >
                        Download PDF
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-center text-blue-600 text-lg py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    Loading sales data...
                </div>
            )}
            {error && (
                <div className="text-center text-red-600 text-lg py-10">
                    <p>{error}</p>
                </div>
            )}

            {!loading && !error && (
                <div className="overflow-x-auto rounded-lg shadow-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Day</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider">Days in Period</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider">Total Customers</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider">Total Quantity</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider">Avg Sales p/Customer</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider">Avg Sales per Day</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider">Total Sales</th>
                                <th className="px-3 py-3 text-center text-xs font-bold text-gray-100 uppercase tracking-wider">% of Total Sales</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {salesData.length > 0 ? (
                                salesData.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.Month}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{row.day}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{row.Customers}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{row.Quantity}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">£{row.AvgSalesPcustomer}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">£{row.AvgSalesPerDay}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">£{row.Sales}</td>
                                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{row.PercentageSales}%</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-3 py-4 text-center text-sm text-gray-500">No data available for the selected date range.</td>
                                </tr>
                            )}
                            {salesData.length > 0 && (
                                <tr className="bg-gray-100 font-bold">
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">Total for Range</td>
                                    <td colSpan="5" className="px-3 py-4 whitespace-nowrap text-sm text-gray-900"></td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">£{totalSalesForRange.toFixed(2)}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">100.00%</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default WeeklySalesDashboard;