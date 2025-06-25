import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../firebase/config';
import { useAuth } from '../../auth/AuthContext';
import { ROLES } from '../../config/roles';

const CustomerOrderTrendReport = () => {
    const { user, loading: authLoading } = useAuth();
    const isAdmin = user?.role === ROLES.ADMIN;
    const isManager = user?.role === ROLES.MANAGER;
    const canViewReport = isAdmin || isManager;

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchCustomer, setSearchCustomer] = useState('');
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState(null);

    const generateReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        setReportData([]);

        try {
            const startTimestamp = startDate ? Timestamp.fromDate(new Date(startDate)) : null;
            const endTimestamp = endDate ? Timestamp.fromDate(new Date(endDate + 'T23:59:59')) : null;

            let kotQueryRef = collection(db, 'KOT');
            if (startTimestamp && endTimestamp) {
                kotQueryRef = query(kotQueryRef, where('date', '>=', startTimestamp), where('date', '<=', endTimestamp));
            } else if (startTimestamp) {
                kotQueryRef = query(kotQueryRef, where('date', '>=', startTimestamp));
            } else if (endTimestamp) {
                kotQueryRef = query(kotQueryRef, where('date', '<=', endTimestamp));
            }
            const kotSnapshot = await getDocs(kotQueryRef);
            const kotData = kotSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const customersSnapshot = await getDocs(collection(db, 'customers'));
            const customersData = customersSnapshot.docs.map(doc => doc.data());
            const customerMap = new Map(customersData.map(cust => [cust.customerID, cust.name]));

            const customerOrderAggregations = {};

            customersData.forEach(customer => {
                customerOrderAggregations[customer.customerID] = {
                    customer_id: customer.customerID,
                    customer_name: customer.name || 'Unknown Customer',
                    unique_items_set: new Set(),
                    total_quantity: 0,
                    total_sales: 0,
                    order_count: 0,
                    item_frequency: {},
                    order_dates: [],
                };
            });

            kotData.forEach(kot => {
                const customerId = kot.customerID;
                if (customerOrderAggregations[customerId]) {
                    customerOrderAggregations[customerId].total_sales += parseFloat(kot.amount || 0);
                    customerOrderAggregations[customerId].order_count += 1;
                    if (kot.date && kot.date instanceof Timestamp) {
                        customerOrderAggregations[customerId].order_dates.push(kot.date.toDate());
                    }

                    if (kot.items && Array.isArray(kot.items)) {
                        kot.items.forEach(item => {
                            customerOrderAggregations[customerId].unique_items_set.add(item.id);
                            customerOrderAggregations[customerId].total_quantity += (item.quantity || 0);
                            customerOrderAggregations[customerId].item_frequency[item.name] =
                                (customerOrderAggregations[customerId].item_frequency[item.name] || 0) + (item.quantity || 1);
                        });
                    }
                }
            });

            const processedReportData = [];
            const totalSalesAcrossAllCustomers = Object.values(customerOrderAggregations).reduce((sum, data) => sum + data.total_sales, 0);

            for (const customerId in customerOrderAggregations) {
                const data = customerOrderAggregations[customerId];
                const customerName = data.customer_name;

                if (searchCustomer && !customerName.toLowerCase().includes(searchCustomer.toLowerCase())) {
                    continue;
                }

                if (data.order_count === 0 && (startDate || endDate)) {
                    continue;
                }

                const uniqueItems = data.unique_items_set.size;
                const avgSales = data.order_count > 0 ? (data.total_sales / data.order_count) : 0;
                const salesPercentage = totalSalesAcrossAllCustomers > 0 ? (data.total_sales / totalSalesAcrossAllCustomers) * 100 : 0;

                let mostCommonItem = 'N/A';
                let maxFrequency = 0;
                for (const item in data.item_frequency) {
                    if (data.item_frequency[item] > maxFrequency) {
                        maxFrequency = data.item_frequency[item];
                        mostCommonItem = item;
                    }
                }

                let team = 'N/A';
                const customerOrderDates = data.order_dates.sort((a, b) => a - b);

                if (customerOrderDates.length > 0) {
                    const minDate = customerOrderDates[0];
                    const maxDate = customerOrderDates[customerOrderDates.length - 1];

                    let isWeekly = true;
                    if (minDate && maxDate) {
                        let currentCheckDate = new Date(minDate);
                        currentCheckDate.setDate(currentCheckDate.getDate() - (currentCheckDate.getDay() + 6) % 7);
                        currentCheckDate.setHours(0,0,0,0);

                        while (currentCheckDate <= maxDate) {
                            const weekStart = new Date(currentCheckDate);
                            const weekEnd = new Date(currentCheckDate);
                            weekEnd.setDate(weekEnd.getDate() + 6);
                            weekEnd.setHours(23,59,59,999);

                            const hasOrderInWeek = customerOrderDates.some(orderDate =>
                                orderDate >= weekStart && orderDate <= weekEnd
                            );
                            if (!hasOrderInWeek) {
                                isWeekly = false;
                                break;
                            }
                            currentCheckDate.setDate(currentCheckDate.getDate() + 7);
                        }
                    } else {
                        isWeekly = false;
                    }

                    if (isWeekly) {
                        team = 'weekly';
                    } else {
                        let isMonthly = true;
                        if (minDate && maxDate) {
                            let currentMonthCheck = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
                            currentMonthCheck.setHours(0,0,0,0);

                            while (currentMonthCheck <= maxDate) {
                                const monthStart = new Date(currentMonthCheck);
                                const monthEnd = new Date(currentMonthCheck.getFullYear(), currentMonthCheck.getMonth() + 1, 0, 23, 59, 59, 999);

                                const hasOrderInMonth = customerOrderDates.some(orderDate =>
                                    orderDate >= monthStart && orderDate <= monthEnd
                                );
                                if (!hasOrderInMonth) {
                                    isMonthly = false;
                                    break;
                                }
                                currentMonthCheck.setMonth(currentMonthCheck.getMonth() + 1);
                            }
                        } else {
                            isMonthly = false;
                        }

                        if (isMonthly) {
                            team = 'monthly';
                        }
                    }
                }

                processedReportData.push({
                    customer_id: data.customer_id,
                    customer_name: customerName,
                    unique_items: uniqueItems,
                    quantity: data.total_quantity,
                    avg_sales: avgSales.toFixed(2),
                    sales: data.total_sales.toFixed(2),
                    sales_percentage: salesPercentage.toFixed(2) + '%',
                    most_common_item: mostCommonItem,
                    team: team,
                });
            }

            setReportData(processedReportData);
        } catch (err) {
            console.error("Error generating report:", err);
            setError("Failed to generate report. Please check console for details.");
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, searchCustomer]);

    const handleDownloadCSV = () => {
        if (reportData.length === 0) {
            console.warn('No data to download for CSV.');
            return;
        }

        const headers = [
            'Customer ID', 'Customer Name', 'Unique Items', 'Quantity',
            'Avg Sales', 'Sales', 'Sales %', 'Most Common Item'
        ];

        const rows = reportData.map(row => [
            row.customer_id,
            row.customer_name,
            row.unique_items,
            row.quantity,
            `£${row.avg_sales}`,
            `£${row.sales}`,
            `£ ${row.sales_percentage}`,
            row.most_common_item
        ]);

        const totalCustomers = reportData.length;
        const totalQuantity = reportData.reduce((sum, row) => sum + row.quantity, 0);
        const totalSales = reportData.reduce((sum, row) => sum + parseFloat(row.sales), 0);

        const totalRow = [`Total Customers: ${totalCustomers}`, '', '', totalQuantity, '', `£${totalSales.toFixed(2)}`, '', ''];

        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(item => `"${String(item).replace(/"/g, '""')}"`).join(',') + '\n';
        });
        csvContent += totalRow.map(item => `"${String(item).replace(/"/g, '""')}"`).join(',') + '\n';

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'Customer_Order_Trend_Report.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadPDF = () => {
        if (reportData.length === 0) {
            console.warn('No data to download for PDF.');
            return;
        }

        try {
            const doc = new jsPDF();

            doc.setFontSize(18);
            doc.text("Customer Order Trend Report", 14, 22);

            if (startDate && endDate) {
                doc.setFontSize(10);
                doc.text(`Report for: ${startDate} to ${endDate}`, 14, 30);
            } else if (startDate) {
                doc.setFontSize(10);
                doc.text(`Report from: ${startDate}`, 14, 30);
            } else if (endDate) {
                doc.setFontSize(10);
                doc.text(`Report up to: ${endDate}`, 14, 30);
            }

            const tableColumn = [
                "Customer ID", "Customer Name", "Unique Items", "Quantity",
                "Avg Sales", "Sales", "Sales %", "Most Common Item"
            ];

            const tableRows = reportData.map(row => [
                row.customer_id,
                row.customer_name,
                row.unique_items,
                row.quantity,
                `£${row.avg_sales}`,
                `£${row.sales}`,
                `£ ${row.sales_percentage}`,
                row.most_common_item
            ]);

            const totalCustomers = reportData.length;
            const totalQuantity = reportData.reduce((sum, row) => sum + row.quantity, 0);
            const totalSales = reportData.reduce((sum, row) => sum + parseFloat(row.sales), 0);

            autoTable(doc, {
                startY: 40,
                head: [tableColumn],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [60, 141, 188] },
                didDrawPage: function(data) {
                    let str = "Page " + doc.internal.getNumberOfPages();
                    doc.setFontSize(10);
                    doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
                },
                foot: [
                    [
                        { content: `Total Customers: ${totalCustomers}`, colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
                        '',
                        totalQuantity,
                        '',
                        `£${totalSales.toFixed(2)}`,
                        '',
                        ''
                    ]
                ],
                footStyles: {
                    fontStyle: 'bold',
                    textColor: [0, 0, 0],
                    fillColor: [240, 240, 240]
                },
            });

            doc.save('Customer_Order_Trend_Report.pdf');
        } catch (pdfError) {
            console.error("Error generating PDF:", pdfError);
        }
    };

    const handleSort = (column) => {
        if (column === 'customer_id') {
            return;
        }

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
        let currentData = [...reportData];

        if (searchCustomer) {
            currentData = currentData.filter(customer =>
                customer.customer_name.toLowerCase().includes(searchCustomer.toLowerCase())
            );
        }

        if (sortColumn && sortDirection) {
            currentData.sort((a, b) => {
                const aValue = a[sortColumn];
                const bValue = b[sortColumn];

                if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
                if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? -1 : 1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    const cleanA = aValue.replace('£', '').replace('%', '').trim();
                    const cleanB = bValue.replace('£', '').replace('%', '').trim();

                    if (sortColumn === 'sales_percentage') {
                        return sortDirection === 'asc'
                            ? parseFloat(cleanA) - parseFloat(cleanB)
                            : parseFloat(cleanB) - parseFloat(cleanA);
                    }
                    return sortDirection === 'asc'
                        ? cleanA.localeCompare(cleanB)
                        : cleanB.localeCompare(cleanA);
                } else {
                    return sortDirection === 'asc'
                        ? aValue - bValue
                        : bValue - aValue;
                }
            });
        }
        return currentData;
    }, [reportData, searchCustomer, sortColumn, sortDirection]);

    useEffect(() => {
        if (!authLoading && canViewReport) {
            generateReport();
        }
    }, [authLoading, canViewReport, generateReport]);

    const getSortIndicator = (column) => {
        if (sortColumn === column) {
            if (sortDirection === 'asc') return ' ▲';
            if (sortDirection === 'desc') return ' ▼';
        }
        return '';
    };

    const totalCustomersDisplay = filteredAndSortedReportData.length;
    const totalQuantityDisplay = filteredAndSortedReportData.reduce((sum, row) => sum + row.quantity, 0);
    const totalSalesDisplay = filteredAndSortedReportData.reduce((sum, row) => sum + parseFloat(row.sales), 0);

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
        <div className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Customer Order Trend Report</h2>

            <div className="flex flex-wrap items-center gap-4 mb-6">
                <label htmlFor="startDate" className="sr-only">Start Date</label>
                <input
                    type="date"
                    id="startDate"
                    className="px-2 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
                <label htmlFor="endDate" className="sr-only">End Date</label>
                <input
                    type="date"
                    id="endDate"
                    className="px-2 py-2 rounded-lg bg-white border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
                <label htmlFor="searchCustomer" className="sr-only">Search by Customer Name</label>
                <input
                    type="text"
                    id="searchCustomer"
                    placeholder="Search by Customer Name"
                    className="p-2 border bg-white border-gray-300 rounded-md flex-grow focus:ring-blue-500 focus:border-blue-500"
                    value={searchCustomer}
                    onChange={(e) => setSearchCustomer(e.target.value)}
                />
                <button
                    className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-md hover:bg-blue-700 transition duration-300 ease-in-out font-semibold"
                    onClick={generateReport}
                    disabled={loading}
                >
                    {loading ? 'Generating...' : 'Generate Report'}
                </button>
                <button
                    className="bg-green-500 text-white px-6 py-2 rounded-md shadow-md hover:bg-green-600 transition duration-300 ease-in-out font-semibold"
                    onClick={handleDownloadCSV}
                    disabled={filteredAndSortedReportData.length === 0}
                >
                    Download CSV
                </button>
                <button
                    className="bg-red-500 text-white px-6 py-2 rounded-md shadow-md hover:bg-red-600 transition duration-300 ease-in-out font-semibold"
                    onClick={handleDownloadPDF}
                    disabled={filteredAndSortedReportData.length === 0}
                >
                    Download PDF
                </button>
            </div>

            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</div>}

            {loading && <p className="text-blue-600 text-center py-4">Loading data...</p>}

            {!loading && filteredAndSortedReportData.length > 0 ? (
                <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
                    <table className="min-w-full bg-white divide-y divide-gray-200">
                        <thead style={{ backgroundColor: '#2D3748' }}>
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider rounded-tl-lg">Customer ID</th>
                                <th
                                    className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('customer_name')}
                                >
                                    Customer Name{getSortIndicator('customer_name')}
                                </th>
                                <th
                                    className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('unique_items')}
                                >
                                    Unique Items{getSortIndicator('unique_items')}
                                </th>
                                <th
                                    className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('quantity')}
                                >
                                    Quantity{getSortIndicator('quantity')}
                                </th>
                                <th
                                    className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('avg_sales')}
                                >
                                    Avg Sales{getSortIndicator('avg_sales')}
                                </th>
                                <th
                                    className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('sales')}
                                >
                                    Sales{getSortIndicator('sales')}
                                </th>
                                <th
                                    className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('sales_percentage')}
                                >
                                    Sales %{getSortIndicator('sales_percentage')}
                                </th>
                                <th
                                    className="py-3 px-4 text-left text-xs font-medium text-gray-100 uppercase tracking-wider rounded-tr-lg cursor-pointer"
                                    onClick={() => handleSort('most_common_item')}
                                >
                                    Most Common Item{getSortIndicator('most_common_item')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAndSortedReportData.map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">{row.customer_id}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">{row.customer_name}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">{row.unique_items}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">{row.quantity}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">£{row.avg_sales}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">£{row.sales}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">£ {row.sales_percentage}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">{row.most_common_item}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900" colSpan="2">Total Customers: {totalCustomersDisplay}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900"></td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">{totalQuantityDisplay}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900"></td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900">£{totalSalesDisplay.toFixed(2)}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900"></td>
                                <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : (
                !loading && <p className="mt-4 text-gray-600 text-center py-4">No data to display. Please select a date range and generate the report.</p>
            )}
        </div>
    );
};

export default CustomerOrderTrendReport;