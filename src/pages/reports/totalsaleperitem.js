import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../firebase/config';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';

const SalesPerItemsReport = () => {
    const { user, loading: authLoading } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const isManager = user?.role === ROLES.MANAGER;
    const canViewReport = isAdmin || isManager;

    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
    });

    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [allItems, setAllItems] = useState([]);
    const [message, setMessage] = useState(null);
    const [selectedItemName, setSelectedItemName] = useState('');

    const [sortColumn, setSortColumn] = useState('Sales');
    const [sortDirection, setSortDirection] = useState('desc');

    const [grandSummary, setGrandSummary] = useState({
        totalCustomersOverall: 0,
        totalQuantityOverall: 0,
        totalSalesOverall: 0,
        avgSalesOverall: 0,
        percentageSalesOverall: 100
    });

    useEffect(() => {
        const fetchAllItems = async () => {
            try {
                const itemsColRef = collection(db, 'items');
                const itemsSnapshot = await getDocs(itemsColRef);
                const itemsList = itemsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    itemName: doc.data().itemName || doc.data().name || `Item ${doc.id}`
                }));
                setAllItems(itemsList);
                console.log("All items fetched:", itemsList);
            } catch (err) {
                console.error("Error fetching all items:", err);
                setError("Failed to fetch all items. Please check console for details.");
            }
        };
        fetchAllItems();
    }, []);

    const generateReport = useCallback(async () => {
        setMessage(null);
        if (!startDate || !endDate || allItems.length === 0) {
            setError("Please select both start and end dates and ensure item data is loaded.");
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

        if (startDate > endDate) {
            setError("Start date cannot be after end date.");
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
            const startOfDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

            const startTimestamp = Timestamp.fromDate(startOfDay);
            const endTimestamp = Timestamp.fromDate(endOfDay);

            const q = query(
                kotRef,
                where('date', '>=', startTimestamp),
                where('date', '<=', endTimestamp),
                orderBy('date')
            );

            const querySnapshot = await getDocs(q);
            const kotData = [];
            querySnapshot.forEach((doc) => {
                kotData.push({ id: doc.id, ...doc.data() });
            });

            console.log("Fetched KOTs for period:", kotData.length);
            if (kotData.length === 0) {
                console.log("No KOT documents found for the selected date range.");
            }

            const itemSalesMap = new Map();
            allItems.forEach(item => {
                itemSalesMap.set(item.id, {
                    totalQuantity: 0,
                    totalSales: 0,
                    uniqueCustomers: 0,
                    customerIdsSet: new Set(),
                    itemName: item.itemName
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

                if (kotDateObj >= startOfDay && kotDateObj <= endOfDay) {
                    const customerId = kot.customerID;
                    if (customerId) {
                        grandUniqueCustomerIds.add(customerId);
                    }

                    if (kot.items && Array.isArray(kot.items)) {
                        kot.items.forEach(item => {
                            const itemId = item.id;
                            const quantity = item.quantity || 0;
                            const price = item.price || 0;
                            const itemSale = quantity * price;

                            const existingData = itemSalesMap.get(itemId);
                            if (existingData) {
                                existingData.totalQuantity += quantity;
                                existingData.totalSales += itemSale;
                                grandTotalSales += itemSale;

                                if (customerId && !existingData.customerIdsSet.has(customerId)) {
                                    existingData.customerIdsSet.add(customerId);
                                    existingData.uniqueCustomers = existingData.customerIdsSet.size;
                                }
                            } else {
                                console.warn(`Item with ID "${itemId}" found in KOT but not in 'items' collection. Skipping sales data for this item.`);
                            }
                        });
                    }
                }
            });

            const processedData = Array.from(itemSalesMap.entries()).map(([itemId, data]) => {
                const totalSales = data.totalSales;
                const totalQuantity = data.totalQuantity;
                const uniqueCustomers = data.uniqueCustomers;
                const avgSales = uniqueCustomers > 0 ? (totalSales / uniqueCustomers) : 0;
                const percentageSales = grandTotalSales > 0 ? (totalSales / grandTotalSales * 100) : 0;

                return {
                    Item_Id: itemId,
                    Item_name: data.itemName,
                    Customers: uniqueCustomers,
                    Quantity: totalQuantity,
                    Avg_Sales: parseFloat(avgSales.toFixed(2)),
                    Sales: parseFloat(totalSales.toFixed(2)),
                    Percentage_Sales: parseFloat(percentageSales.toFixed(2)),
                };
            });

            const initialRankedData = processedData.sort((a, b) => b.Sales - a.Sales).map((item, index) => ({
                ...item,
                Rank: index + 1
            }));

            setReportData(initialRankedData);
            console.log("Initial Report Data (including zero sales):", initialRankedData);

            const totalCustomersOverall = grandUniqueCustomerIds.size;
            const totalQuantityOverall = initialRankedData.reduce((sum, item) => sum + item.Quantity, 0);
            const totalSalesOverall = initialRankedData.reduce((sum, item) => sum + item.Sales, 0);
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
            console.error("Error generating report:", err);
            setError("Failed to generate report. Please check your data and network connection.");
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
    }, [startDate, endDate, allItems]);

    useEffect(() => {
        if (!authLoading && canViewReport && allItems.length > 0) {
            generateReport();
        }
    }, [authLoading, canViewReport, allItems, generateReport]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortColumn(null);
                setSortDirection(null);
            }
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const filteredAndSortedReportData = useMemo(() => {
        let currentData = selectedItemName
            ? reportData.filter(item => item.Item_name === selectedItemName)
            : [...reportData];

        if (sortColumn && sortDirection) {
            currentData.sort((a, b) => {
                const aValue = a[sortColumn];
                const bValue = b[sortColumn];

                if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
                if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? -1 : 1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortDirection === 'asc'
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                } else {
                    return sortDirection === 'asc'
                        ? aValue - bValue
                        : bValue - aValue;
                }
            });
        }
        return currentData;
    }, [reportData, selectedItemName, sortColumn, sortDirection]);

    const downloadCSV = () => {
        if (filteredAndSortedReportData.length === 0) {
            setMessage('No data to download.');
            return;
        }

        const headers = [
            "Item_Id", "Item_name", "Customers", "Quantity",
            "Avg Sales", "Sales", "% Sales", "Rank"
        ];
        const rows = filteredAndSortedReportData.map(row => [
            row.Item_Id,
            row.Item_name,
            row.Customers,
            row.Quantity,
            `£${row.Avg_Sales}`,
            `£${row.Sales}`,
            `${row.Percentage_Sales}%`,
            row.Rank
        ]);

        rows.push([
            "TOTAL", "",
            grandSummary.totalCustomersOverall,
            grandSummary.totalQuantityOverall,
            `£${grandSummary.avgSalesOverall}`,
            `£${grandSummary.totalSalesOverall}`,
            `${grandSummary.percentageSalesOverall}%`,
            ""
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SalesPerItemsReport");
        const csv = XLSX.write(workbook, { type: "array", bookType: "csv" });
        saveAs(new Blob([csv], { type: "text/csv" }), "SalesPerItemsReport.csv");
    };

    const downloadPDF = () => {
        if (filteredAndSortedReportData.length === 0) {
            setMessage('No data to download.');
            return;
        }

        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Total Sales Per Items Report", 14, 20);

        const tableColumn = [
            "Item Id", "Day of Week",
            "Customers", "Total Quantity",
            "Avg Sales",
            "Total Sales",
 "%",
            "Rank"
        ];
        const tableRows = filteredAndSortedReportData.map(row => [
            row.Item_Id,
            row.Item_name,
            row.Customers,
            row.Quantity,
            `£${row.Avg_Sales}`,
            `£${row.Sales}`,
            `${row.Percentage_Sales}%`,
            row.Rank
        ]);

        try {
            autoTable(doc, {
                startY: 30,
                head: [tableColumn],
                body: tableRows,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                foot: [
                    ["TOTAL", "",
                        grandSummary.totalCustomersOverall,
                        grandSummary.totalQuantityOverall,
                        `£${grandSummary.avgSalesOverall}`,
                        `£${grandSummary.totalSalesOverall}`,
                        `${grandSummary.percentageSalesOverall}%`,
                        ""]
                ],
                footStyles: {
                    fillColor: [52, 73, 94],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                }
            });

            doc.save("SalesPerItemsReport.pdf");
            console.log("PDF download initiated successfully.");
        } catch (err) {
            console.error("Error during PDF generation or saving:", err);
            setError(`Failed to generate PDF: ${err.message}. Check console for details.`);
        }
    };

    const getSortIndicator = (column) => {
        if (sortColumn === column) {
            if (sortDirection === 'asc') return ' ▲';
            if (sortDirection === 'desc') return ' ▼';
        }
        return '';
    };

    if (authLoading) {
        return (
            <div className="p-4 bg-white rounded-lg shadow-md">
                <p className="text-blue-600 text-center py-4">Checking Authentication...</p>
            </div>
        );
    }

    if (!canViewReport) {
        return (
            <div className="p-4 bg-white rounded-lg shadow-md">
                <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">
                    Access Denied: Only managers and admins can view this report.
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 text-gray-800 w-full">
            <h2 className="text-2xl font-bold mb-4">Total Sales Per Items</h2>

            <div className="bg-white p-2 rounded-lg shadow-md mb-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex items-center space-x-2">
                    <label htmlFor="startDate" className="font-medium">Start Date:</label>
                    <DatePicker
                        id="startDate"
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        dateFormat="MM/dd/yyyy"
                        className="px-2 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholderText="Select start date"
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <label htmlFor="endDate" className="font-medium">End Date:</label>
                    <DatePicker
                        id="endDate"
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        dateFormat="MM/dd/yyyy"
                        className="px-4 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholderText="Select end date"
                    />
                </div>
                <button
                    onClick={generateReport}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-2 rounded-lg transition duration-200 ease-in-out shadow-md transform hover:scale-105"
                    disabled={loading || allItems.length === 0}
                >
                    {loading ? 'Generating...' : 'Generate Report'}
                </button>
                <button
                    onClick={downloadCSV}
                    className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                    disabled={filteredAndSortedReportData.length === 0}
                >
                    Download CSV
                </button>
                <button
                    onClick={downloadPDF}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                    disabled={filteredAndSortedReportData.length === 0}
                >
                    Download PDF
                </button>
            </div>
            <div className="bg-white p-2 rounded-lg shadow-md mb-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex items-center space-x-2">
                    <label htmlFor="selectItem" className="font-medium">Select Item:</label>
                    <select
                        id="selectItem"
                        value={selectedItemName}
                        onChange={(e) => setSelectedItemName(e.target.value)}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={allItems.length === 0}
                    >
                        <option value="">-- Select an Item --</option>
                        {allItems.map(item => (
                            <option key={item.id} value={item.itemName}>
                                {item.itemName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {message && <div className="text-blue-500 mb-4">{message}</div>}

            {filteredAndSortedReportData.length > 0 ? (
                <div className="overflow-x-auto bg-white rounded-lg shadow-md">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead style={{ backgroundColor: '#2D3748' }}>
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Item_Id')}
                                >
                                    Item Id{getSortIndicator('Item_Id')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Item_name')}
                                >
                                    Item Name{getSortIndicator('Item_name')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Customers')}
                                >
                                    Customers{getSortIndicator('Customers')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Quantity')}
                                >
                                    Quantity{getSortIndicator('Quantity')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Avg_Sales')}
                                >
                                    Avg Sales{getSortIndicator('Avg_Sales')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Sales')}
                                >
                                    Sales{getSortIndicator('Sales')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Percentage_Sales')}
                                >
                                    % Sales{getSortIndicator('Percentage_Sales')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('Rank')}
                                >
                                    Rank{getSortIndicator('Rank')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAndSortedReportData.map((row) => (
                                <tr key={row.Item_Id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.Item_Id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Item_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Customers}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Quantity}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">£{row.Avg_Sales}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">£{row.Sales}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Percentage_Sales}%</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Rank}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.totalCustomersOverall}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.totalQuantityOverall}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£{grandSummary.avgSalesOverall}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£{grandSummary.totalSalesOverall}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.percentageSalesOverall}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="p-4 text-center text-gray-500">
                    No data to display for the selected period, or items are still loading.
                </div>
            )}
        </div>
    );
};

export default SalesPerItemsReport;


// import React, { useState, useEffect, useMemo, useCallback } from 'react';
// import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
// import { format, parseISO } from 'date-fns';
// import { saveAs } from 'file-saver';
// import * as XLSX from 'xlsx';
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import { db } from '../../firebase/config';
// import { useAuth } from '../../auth/AuthContext';
// import { ROLES } from '../../config/roles';

// const SalesPerItemsReport = () => {
//     const { user, loading: authLoading } = useAuth();
//     const isAdmin = user?.role === ROLES.ADMIN;
//     const isManager = user?.role === ROLES.MANAGER;
//     const canViewReport = isAdmin || isManager;

//     const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
//     const [startDate, setStartDate] = useState(() => {
//         const d = new Date();
//         d.setDate(d.getDate() - 7);
//         return d.toISOString().split('T')[0];
//     });

//     const [reportData, setReportData] = useState([]);
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState(null);
//     const [allItems, setAllItems] = useState([]);
//     const [message, setMessage] = useState(null);
//     const [selectedItemName, setSelectedItemName] = useState('');
//     const [sortColumn, setSortColumn] = useState('Sales');
//     const [sortDirection, setSortDirection] = useState('desc');

//     const [grandSummary, setGrandSummary] = useState({
//         totalCustomersOverall: 0,
//         totalQuantityOverall: 0,
//         totalSalesOverall: 0,
//         avgSalesOverall: 0,
//         percentageSalesOverall: 100
//     });

//     useEffect(() => {
//         const fetchAllItems = async () => {
//             try {
//                 const itemsColRef = collection(db, 'items');
//                 const itemsSnapshot = await getDocs(itemsColRef);
//                 const itemsList = itemsSnapshot.docs.map(doc => ({
//                     id: doc.id,
//                     itemName: doc.data().itemName || doc.data().name || `Item ${doc.id}`
//                 }));
//                 setAllItems(itemsList);
//                 console.log("All items fetched:", itemsList);
//             } catch (err) {
//                 console.error("Error fetching all items:", err);
//                 setError("Failed to fetch all items. Please check console for details.");
//             }
//         };
//         fetchAllItems();
//     }, []);

//     const generateReport = useCallback(async () => {
//         setMessage(null);
//         if (!startDate || !endDate || allItems.length === 0) {
//             setError("Please select both start and end dates and ensure item data is loaded.");
//             setReportData([]);
//             setGrandSummary({
//                 totalCustomersOverall: 0,
//                 totalQuantityOverall: 0,
//                 totalSalesOverall: 0,
//                 avgSalesOverall: 0,
//                 percentageSalesOverall: 0
//             });
//             return;
//         }

//         if (new Date(startDate) > new Date(endDate)) {
//             setError("Start date cannot be after end date.");
//             setReportData([]);
//             setGrandSummary({
//                 totalCustomersOverall: 0,
//                 totalQuantityOverall: 0,
//                 totalSalesOverall: 0,
//                 avgSalesOverall: 0,
//                 percentageSalesOverall: 0
//             });
//             return;
//         }

//         setLoading(true);
//         setError(null);
//         setReportData([]);

//         try {
//             const kotRef = collection(db, 'KOT');
//             const startOfDay = new Date(startDate);
//             const endOfDay = new Date(endDate);
//             endOfDay.setHours(23, 59, 59, 999);

//             const startTimestamp = Timestamp.fromDate(startOfDay);
//             const endTimestamp = Timestamp.fromDate(endOfDay);

//             const q = query(
//                 kotRef,
//                 where('date', '>=', startTimestamp),
//                 where('date', '<=', endTimestamp),
//                 orderBy('date')
//             );

//             const querySnapshot = await getDocs(q);
//             const kotData = [];
//             querySnapshot.forEach((doc) => {
//                 kotData.push({ id: doc.id, ...doc.data() });
//             });

//             console.log("Fetched KOTs for period:", kotData.length);
//             if (kotData.length === 0) {
//                 console.log("No KOT documents found for the selected date range.");
//             }

//             const itemSalesMap = new Map();
//             allItems.forEach(item => {
//                 itemSalesMap.set(item.id, {
//                     totalQuantity: 0,
//                     totalSales: 0,
//                     uniqueCustomers: 0,
//                     customerIdsSet: new Set(),
//                     itemName: item.itemName
//                 });
//             });

//             let grandTotalSales = 0;
//             const grandUniqueCustomerIds = new Set();

//             kotData.forEach(kot => {
//                 let kotDateObj;
//                 if (kot.date && typeof kot.date.toDate === 'function') {
//                     kotDateObj = kot.date.toDate();
//                 } else if (typeof kot.date === 'string') {
//                     kotDateObj = parseISO(kot.date);
//                 } else {
//                     console.warn("KOT date field is not a Timestamp or ISO string. Skipping KOT:", kot.id, kot.date);
//                     return;
//                 }

//                 if (kotDateObj >= startOfDay && kotDateObj <= endOfDay) {
//                     const customerId = kot.customerID;
//                     if (customerId) {
//                         grandUniqueCustomerIds.add(customerId);
//                     }

//                     if (kot.items && Array.isArray(kot.items)) {
//                         kot.items.forEach(item => {
//                             const itemId = item.id;
//                             const quantity = item.quantity || 0;
//                             const price = item.price || 0;
//                             const itemSale = quantity * price;

//                             const existingData = itemSalesMap.get(itemId);
//                             if (existingData) {
//                                 existingData.totalQuantity += quantity;
//                                 existingData.totalSales += itemSale;
//                                 grandTotalSales += itemSale;

//                                 if (customerId && !existingData.customerIdsSet.has(customerId)) {
//                                     existingData.customerIdsSet.add(customerId);
//                                     existingData.uniqueCustomers = existingData.customerIdsSet.size;
//                                 }
//                             } else {
//                                 console.warn(`Item with ID "${itemId}" found in KOT but not in 'items' collection. Skipping sales data for this item.`);
//                             }
//                         });
//                     }
//                 }
//             });

//             const processedData = Array.from(itemSalesMap.entries()).map(([itemId, data]) => {
//                 const totalSales = data.totalSales;
//                 const totalQuantity = data.totalQuantity;
//                 const uniqueCustomers = data.uniqueCustomers;
//                 const avgSales = uniqueCustomers > 0 ? (totalSales / uniqueCustomers) : 0;
//                 const percentageSales = grandTotalSales > 0 ? (totalSales / grandTotalSales * 100) : 0;

//                 return {
//                     Item_Id: itemId,
//                     Item_name: data.itemName,
//                     Customers: uniqueCustomers,
//                     Quantity: totalQuantity,
//                     Avg_Sales: parseFloat(avgSales.toFixed(2)),
//                     Sales: parseFloat(totalSales.toFixed(2)),
//                     Percentage_Sales: parseFloat(percentageSales.toFixed(2)),
//                 };
//             });

//             const initialRankedData = processedData.sort((a, b) => b.Sales - a.Sales).map((item, index) => ({
//                 ...item,
//                 Rank: index + 1
//             }));

//             setReportData(initialRankedData);
//             console.log("Initial Report Data (including zero sales):", initialRankedData);

//             const totalCustomersOverall = grandUniqueCustomerIds.size;
//             const totalQuantityOverall = initialRankedData.reduce((sum, item) => sum + item.Quantity, 0);
//             const totalSalesOverall = initialRankedData.reduce((sum, item) => sum + item.Sales, 0);
//             const avgSalesOverall = totalCustomersOverall > 0 ? (totalSalesOverall / totalCustomersOverall) : 0;
//             const percentageSalesOverall = totalSalesOverall > 0 ? 100 : 0;

//             setGrandSummary({
//                 totalCustomersOverall: totalCustomersOverall,
//                 totalQuantityOverall: totalQuantityOverall,
//                 totalSalesOverall: parseFloat(totalSalesOverall.toFixed(2)),
//                 avgSalesOverall: parseFloat(avgSalesOverall.toFixed(2)),
//                 percentageSalesOverall: parseFloat(percentageSalesOverall.toFixed(2))
//             });

//         } catch (err) {
//             console.error("Error generating report:", err);
//             setError("Failed to generate report. Please check your data and network connection.");
//             setGrandSummary({
//                 totalCustomersOverall: 0,
//                 totalQuantityOverall: 0,
//                 totalSalesOverall: 0,
//                 avgSalesOverall: 0,
//                 percentageSalesOverall: 0
//             });
//         } finally {
//             setLoading(false);
//         }
//     }, [startDate, endDate, allItems]);

//     useEffect(() => {
//         if (!authLoading && canViewReport && allItems.length > 0) {
//             generateReport();
//         }
//     }, [authLoading, canViewReport, allItems, generateReport]);

//     const handleSort = (column) => {
//         if (sortColumn === column) {
//             if (sortDirection === 'asc') {
//                 setSortDirection('desc');
//             } else if (sortDirection === 'desc') {
//                 setSortColumn(null);
//                 setSortDirection(null);
//             }
//         } else {
//             setSortColumn(column);
//             setSortDirection('asc');
//         }
//     };

//     const filteredAndSortedReportData = useMemo(() => {
//         let currentData = selectedItemName
//             ? reportData.filter(item => item.Item_name === selectedItemName)
//             : [...reportData];

//         if (sortColumn && sortDirection) {
//             currentData.sort((a, b) => {
//                 const aValue = a[sortColumn];
//                 const bValue = b[sortColumn];

//                 if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
//                 if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? -1 : 1;

//                 if (typeof aValue === 'string' && typeof bValue === 'string') {
//                     return sortDirection === 'asc'
//                         ? aValue.localeCompare(bValue)
//                         : bValue.localeCompare(bValue);
//                 } else {
//                     return sortDirection === 'asc'
//                         ? aValue - bValue
//                         : bValue - aValue;
//                 }
//             });
//         }
//         return currentData;
//     }, [reportData, selectedItemName, sortColumn, sortDirection]);

//     const downloadCSV = () => {
//         if (filteredAndSortedReportData.length === 0) {
//             setMessage('No data to download.');
//             return;
//         }

//         const headers = [
//             "Item_Id", "Item_name", "Customers", "Quantity",
//             "Avg Sales", "Sales", "% Sales", "Rank"
//         ];
//         const rows = filteredAndSortedReportData.map(row => [
//             row.Item_Id,
//             row.Item_name,
//             row.Customers,
//             row.Quantity,
//             `£${row.Avg_Sales}`,
//             `£${row.Sales}`,
//             `${row.Percentage_Sales}%`,
//             row.Rank
//         ]);

//         rows.push([
//             "TOTAL", "",
//             grandSummary.totalCustomersOverall,
//             grandSummary.totalQuantityOverall,
//             `£${grandSummary.avgSalesOverall}`,
//             `£${grandSummary.totalSalesOverall}`,
//             `${grandSummary.percentageSalesOverall}%`,
//             ""
//         ]);

//         const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
//         const workbook = XLSX.utils.book_new();
//         XLSX.utils.book_append_sheet(workbook, worksheet, "SalesPerItemsReport");
//         const csv = XLSX.write(workbook, { type: "array", bookType: "csv" });
//         saveAs(new Blob([csv], { type: "text/csv" }), "SalesPerItemsReport.csv");
//     };

//     const downloadPDF = () => {
//         if (filteredAndSortedReportData.length === 0) {
//             setMessage('No data to download.');
//             return;
//         }

//         const doc = new jsPDF();
//         doc.setFontSize(16);
//         doc.text("Total Sales Per Items Report", 14, 20);

//         const tableColumn = [
//             "Item Id", "Item Name",
//             "Customers", "Total Quantity",
//             "Avg Sales", "Total Sales",
//             "%", "Rank"
//         ];
//         const tableRows = filteredAndSortedReportData.map(row => [
//             row.Item_Id,
//             row.Item_name,
//             row.Customers,
//             row.Quantity,
//             `£${row.Avg_Sales}`,
//             `£${row.Sales}`,
//             `${row.Percentage_Sales}%`,
//             row.Rank
//         ]);

//         try {
//             autoTable(doc, {
//                 startY: 30,
//                 head: [tableColumn],
//                 body: tableRows,
//                 styles: { fontSize: 8 },
//                 headStyles: { fillColor: [41, 128, 185] },
//                 alternateRowStyles: { fillColor: [240, 240, 240] },
//                 foot: [
//                     ["TOTAL", "",
//                         grandSummary.totalCustomersOverall,
//                         grandSummary.totalQuantityOverall,
//                         `£${grandSummary.avgSalesOverall}`,
//                         `£${grandSummary.totalSalesOverall}`,
//                         `${grandSummary.percentageSalesOverall}%`,
//                         ""]
//                 ],
//                 footStyles: {
//                     fillColor: [52, 73, 94],
//                     textColor: [255, 255, 255],
//                     fontStyle: 'bold'
//                 }
//             });

//             doc.save("SalesPerItemsReport.pdf");
//             console.log("PDF download initiated successfully.");
//         } catch (err) {
//             console.error("Error during PDF generation or saving:", err);
//             setError(`Failed to generate PDF: ${err.message}. Check console for details.`);
//         }
//     };

//     const getSortIndicator = (column) => {
//         if (sortColumn === column) {
//             if (sortDirection === 'asc') return ' ▲';
//             if (sortDirection === 'desc') return ' ▼';
//         }
//         return '';
//     };

//     if (authLoading) {
//         return (
//             <div className="p-4 bg-white rounded-lg shadow-md">
//                 <p className="text-blue-600 text-center py-4">Checking Authentication...</p>
//             </div>
//         );
//     }

//     if (!canViewReport) {
//         return (
//             <div className="p-4 bg-white rounded-lg shadow-md">
//                 <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">
//                     Access Denied: Only managers and admins can view this report.
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="p-6 text-gray-800 w-full">
//             <h2 className="text-2xl font-bold mb-4">Total Sales Per Items</h2>

//             <div className="bg-white p-2 rounded-lg shadow-md mb-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
//                 <div className="flex items-center space-x-2">
//                     <label htmlFor="startDate" className="font-medium">Start Date:</label>
//                     <input
//                         type="date"
//                         id="startDate"
//                         value={startDate}
//                         onChange={(e) => setStartDate(e.target.value)}
//                         className="px-2 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                     />
//                 </div>
//                 <div className="flex items-center space-x-2">
//                     <label htmlFor="endDate" className="font-medium">End Date:</label>
//                     <input
//                         type="date"
//                         id="endDate"
//                         value={endDate}
//                         onChange={(e) => setEndDate(e.target.value)}
//                         className="px-4 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                     />
//                 </div>
//                 <button
//                     onClick={generateReport}
//                     className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-2 rounded-lg transition duration-200 ease-in-out shadow-md transform hover:scale-105"
//                     disabled={loading || allItems.length === 0}
//                 >
//                     {loading ? 'Generating...' : 'Generate Report'}
//                 </button>
//                 <button
//                     onClick={downloadCSV}
//                     className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out"
//                     disabled={filteredAndSortedReportData.length === 0}
//                 >
//                     Download CSV
//                 </button>
//                 <button
//                     onClick={downloadPDF}
//                     className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-150 ease-in-out"
//                     disabled={filteredAndSortedReportData.length === 0}
//                 >
//                     Download PDF
//                 </button>
//             </div>
//             <div className="bg-white p-2 rounded-lg shadow-md mb-6 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
//                 <div className="flex items-center space-x-2">
//                     <label htmlFor="selectItem" className="font-medium">Select Item:</label>
//                     <select
//                         id="selectItem"
//                         value={selectedItemName}
//                         onChange={(e) => setSelectedItemName(e.target.value)}
//                         className="px-4 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                         disabled={allItems.length === 0}
//                     >
//                         <option value="">-- Select an Item --</option>
//                         {allItems.map(item => (
//                             <option key={item.id} value={item.itemName}>
//                                 {item.itemName}
//                             </option>
//                         ))}
//                     </select>
//                 </div>
//             </div>
//             {error && <div className="text-red-500 mb-4">{error}</div>}
//             {message && <div className="text-blue-500 mb-4">{message}</div>}

//             {filteredAndSortedReportData.length > 0 ? (
//                 <div className="overflow-x-auto bg-white rounded-lg shadow-md">
//                     <table className="min-w-full divide-y divide-gray-200">
//                         <thead style={{ backgroundColor: '#2D3748' }}>
//                             <tr>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Item_Id')}
//                                 >
//                                     Item Id{getSortIndicator('Item_Id')}
//                                 </th>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Item_name')}
//                                 >
//                                     Item Name{getSortIndicator('Item_name')}
//                                 </th>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Customers')}
//                                 >
//                                     Customers{getSortIndicator('Customers')}
//                                 </th>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Quantity')}
//                                 >
//                                     Quantity{getSortIndicator('Quantity')}
//                                 </th>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Avg_Sales')}
//                                 >
//                                     Avg Sales{getSortIndicator('Avg_Sales')}
//                                 </th>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Sales')}
//                                 >
//                                     Sales{getSortIndicator('Sales')}
//                                 </th>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Percentage_Sales')}
//                                 >
//                                     % Sales{getSortIndicator('Percentage_Sales')}
//                                 </th>
//                                 <th
//                                     className="px-6 py-3 text-left text-xs font-bold text-gray-100 uppercase tracking-wider cursor-pointer"
//                                     onClick={() => handleSort('Rank')}
//                                 >
//                                     Rank{getSortIndicator('Rank')}
//                                 </th>
//                             </tr>
//                         </thead>
//                         <tbody className="bg-white divide-y divide-gray-200">
//                             {filteredAndSortedReportData.map((row) => (
//                                 <tr key={row.Item_Id}>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.Item_Id}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Item_name}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Customers}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Quantity}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">£{row.Avg_Sales}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">£{row.Sales}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Percentage_Sales}%</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.Rank}</td>
//                                 </tr>
//                             ))}
//                             <tr className="bg-gray-100 font-bold">
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"></td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.totalCustomersOverall}</td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.totalQuantityOverall}</td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£{grandSummary.avgSalesOverall}</td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£{grandSummary.totalSalesOverall}</td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{grandSummary.percentageSalesOverall}%</td>
//                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"></td>
//                             </tr>
//                         </tbody>
//                     </table>
//                 </div>
//             ) : (
//                 <div className="p-4 text-center text-gray-500">
//                     No data to display for the selected period, or items are still loading.
//                 </div>
//             )}
//         </div>
//     );
// };

// export default SalesPerItemsReport;