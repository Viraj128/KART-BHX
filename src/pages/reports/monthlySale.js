import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, parseISO, getYear } from 'date-fns';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { db } from '../../firebase/config';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';

const MonthlySalesDashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const isManager = user?.role === ROLES.MANAGER;
    const canViewReport = isAdmin || isManager;

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [grandSummary, setGrandSummary] = useState({
        totalCustomersOverall: 0,
        totalQuantityOverall: 0,
        totalSalesOverall: 0,
        avgSalesOverall: 0,
        percentageSalesOverall: 100
    });

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const generateReport = useCallback(async () => {
        if (!selectedYear) {
            setError("Please select a year.");
            setReportData([]);
            setGrandSummary({
                totalCustomersOverall: 0,
                totalQuantityOverall: 0,
                totalSalesOverall: 0,
                avgSalesOverall: 0,
                percentageSalesOverall: 0
            });
            return;
        }

        setLoading(true);
        setError(null);
        setReportData([]);

        try {
            const kotRef = collection(db, 'KOT');
            const startOfYear = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
            const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

            const startTimestamp = Timestamp.fromDate(startOfYear);
            const endTimestamp = Timestamp.fromDate(endOfYear);

            const q = query(
                kotRef,
                where('date', '>=', startTimestamp),
                where('date', '<=', endTimestamp)
            );

            const querySnapshot = await getDocs(q);
            const kotData = [];
            querySnapshot.forEach((doc) => {
                kotData.push({ id: doc.id, ...doc.data() });
            });

            console.log(`Fetched ${kotData.length} KOTs for year ${selectedYear}`);
            if (kotData.length === 0) {
                setError(`No KOT documents found for the year ${selectedYear}.`);
            }

            const monthlyDataMap = new Map();
            monthNames.forEach((monthName, index) => {
                monthlyDataMap.set(index, {
                    monthName: monthName,
                    totalQuantity: 0,
                    totalSales: 0,
                    uniqueCustomers: new Set(),
                });
            });

            let grandTotalSales = 0;
            const grandUniqueCustomerIds = new Set();

            kotData.forEach(kot => {
                let kotDateObj;
                if (kot.date && typeof kot.date.toDate === 'function') {
                    kotDateObj = kot.date.toDate();
                } else if (typeof kot.date === 'string') {
                    kotDateObj = parseISO(kot.date);
                } else {
                    console.warn("KOT date field is not a Timestamp or ISO string. Skipping KOT:", kot.id, kot.date);
                    return;
                }

                if (getYear(kotDateObj) === selectedYear) {
                    const monthIndex = kotDateObj.getMonth();
                    const customerId = kot.customerID;
                    if (customerId) {
                        grandUniqueCustomerIds.add(customerId);
                    }

                    const monthEntry = monthlyDataMap.get(monthIndex);
                    if (monthEntry) {
                        if (customerId) {
                            monthEntry.uniqueCustomers.add(customerId);
                        }

                        if (kot.items && Array.isArray(kot.items)) {
                            kot.items.forEach(item => {
                                const quantity = item.quantity || 0;
                                const price = item.price || 0;
                                const itemSale = quantity * price;

                                monthEntry.totalQuantity += quantity;
                                monthEntry.totalSales += itemSale;
                                grandTotalSales += itemSale;
                            });
                        }
                    }
                }
            });

            const finalReportData = Array.from(monthlyDataMap.entries()).map(([monthIndex, data]) => {
                const monthName = data.monthName;
                const customersCount = data.uniqueCustomers.size;
                const quantity = data.totalQuantity;
                const sales = data.totalSales;

                const avgSales = customersCount > 0 ? (sales / customersCount) : 0;
                const percentageSales = grandTotalSales > 0 ? (sales / grandTotalSales * 100) : 0;

                return {
                    Month: monthName,
                    Customers: customersCount,
                    Quantity: quantity,
                    Avg_Sales: parseFloat(avgSales.toFixed(2)),
                    Sales: parseFloat(sales.toFixed(2)),
                    Percentage_Sales: parseFloat(percentageSales.toFixed(2)),
                };
            });

            finalReportData.sort((a, b) => monthNames.indexOf(a.Month) - monthNames.indexOf(b.Month));

            setReportData(finalReportData);
            console.log("Monthly Report Data Generated:", finalReportData);

            const totalCustomersOverall = grandUniqueCustomerIds.size;
            const totalQuantityOverall = finalReportData.reduce((sum, month) => sum + month.Quantity, 0);
            const totalSalesOverall = finalReportData.reduce((sum, month) => sum + month.Sales, 0);
            const avgSalesOverall = totalCustomersOverall > 0 ? (totalSalesOverall / totalCustomersOverall) : 0;
            const percentageSalesOverall = totalSalesOverall > 0 ? 100 : 0;

            setGrandSummary({
                totalCustomersOverall: totalCustomersOverall,
                totalQuantityOverall: totalQuantityOverall,
                totalSalesOverall: parseFloat(totalSalesOverall.toFixed(2)),
                avgSalesOverall: parseFloat(avgSalesOverall.toFixed(2)),
                percentageSalesOverall: parseFloat(percentageSalesOverall.toFixed(2))
            });

        } catch (err) {
            console.error("Error generating monthly sales report:", err);
            setError("Failed to generate monthly sales report. Please check your data and network connection.");
            setGrandSummary({
                totalCustomersOverall: 0,
                totalQuantityOverall: 0,
                totalSalesOverall: 0,
                avgSalesOverall: 0,
                percentageSalesOverall: 0
            });
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        if (!authLoading && canViewReport) {
            generateReport();
        }
    }, [authLoading, canViewReport, generateReport]);

    const downloadCSV = () => {
        if (reportData.length === 0) {
            console.log('No data to download.');
            return;
        }

        const headers = [
            "Month", "Customers", "Quantity", "Avg Sales", "Sales", "% Sales"
        ];
        const rows = reportData.map(row => [
            row.Month,
            row.Customers,
            row.Quantity,
            `£${row.Avg_Sales}`,
            `£${row.Sales}`,
            row.Percentage_Sales + '%'
        ]);

        rows.push([
            "TOTAL",
            grandSummary.totalCustomersOverall,
            grandSummary.totalQuantityOverall,
            `£${grandSummary.avgSalesOverall}`,
            `£${grandSummary.totalSalesOverall}`,
            `${grandSummary.percentageSalesOverall}%`
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `MonthlySales_${selectedYear}`);
        const csv = XLSX.write(workbook, { type: "array", bookType: "csv" });
        saveAs(new Blob([csv], { type: "text/csv" }), `MonthlySales_${selectedYear}.csv`);
    };

    const downloadPDF = () => {
        if (reportData.length === 0) {
            console.log('No data to download.');
            return;
        }

        const { jsPDF: LocalJsPDF } = window.jspdf || {};
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

        doc.setFontSize(16);
        doc.text(`Monthly Sales Dashboard for ${selectedYear}`, 14, 20);

        const tableColumn = [
            "Month", "Customers", "Quantity", "Avg Sales", "Sales", "% Sales"
        ];
        const tableRows = reportData.map(row => [
            row.Month,
            row.Customers,
            row.Quantity,
            `£${row.Avg_Sales}`,
            `£${row.Sales}`,
            row.Percentage_Sales + '%'
        ]);

        try {
            doc.autoTable({
                startY: 30,
                head: [tableColumn],
                body: tableRows,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                foot: [
                    ["TOTAL",
                        grandSummary.totalCustomersOverall,
                        grandSummary.totalQuantityOverall,
                        `£${grandSummary.avgSalesOverall}`,
                        `£${grandSummary.totalSalesOverall}`,
                        `${grandSummary.percentageSalesOverall}%`]
                ],
                footStyles: {
                    fillColor: [52, 73, 94],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                }
            });

            doc.save(`MonthlySales_${selectedYear}.pdf`);
            console.log("PDF download initiated successfully.");
        } catch (pdfError) {
            console.error("Error during PDF generation or saving:", pdfError);
            setError(`Failed to generate PDF: ${pdfError.message}. Check console for details.`);
        }
    };

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

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
        <div className="p-6 text-gray-800 w-full">
            <h2 className="text-2xl font-bold mb-4">Monthly Sales Report</h2>

            <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex items-center space-x-2">
                    <label htmlFor="selectYear" className="font-medium">Select Year:</label>
                    <select
                        id="selectYear"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                        {yearOptions.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={generateReport}
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                    disabled={loading}
                >
                    {loading ? 'Generating...' : 'Generate Report'}
                </button>
                <button
                    onClick={downloadCSV}
                    className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                    disabled={reportData.length === 0}
                >
                    Download CSV
                </button>
                <button
                    onClick={downloadPDF}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                    disabled={reportData.length === 0}
                >
                    Download PDF
                </button>
            </div>

            {error && <div className="text-red-500 mb-4">{error}</div>}

            {reportData.length > 0 && (
                <div className="overflow-x-auto bg-white rounded-lg shadow-md">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Month</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Customers</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Quantity</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Avg Sales</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">Sales</th>
                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider">% Sales</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.map((row) => (
                                <tr key={row.Month}>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.Month}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">{row.Customers}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">{row.Quantity}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">£{row.Avg_Sales}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">£{row.Sales}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">{row.Percentage_Sales}%</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.totalCustomersOverall}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.totalQuantityOverall}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">£{grandSummary.avgSalesOverall}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">£{grandSummary.totalSalesOverall}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.percentageSalesOverall}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {reportData.length === 0 && !loading && !error && (
                <div className="p-4 text-center text-gray-400">
                    No data available for the selected year.
                </div>
            )}
        </div>
    );
};

export default MonthlySalesDashboard;