export interface Employee {
    _id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    lineManager?: string; // This seems to be an ID string based on the user request
    email: string;
    role?: string;
    name?: string;     // Fallback
    fullName?: string; // Fallback
}

export interface Manager {
    _id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    name?: string;
    fullName?: string;
}

// Helper to get full name
export const getFullName = (emp: Employee | Manager) => {
    if (emp.firstName || emp.lastName) {
        return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
    }
    return emp.name || emp.fullName || 'Unknown';
};

const getCompanyId = () => {
    return (new URLSearchParams(window.location.search).get('companyId')) || import.meta.env.VITE_COMPANY_ID || '6396f7d703546500086f0200';
};

const MOCK_EMPLOYEES: Employee[] = [
    {
        _id: "68e240b0d9876d59139672d6",
        employeeNumber: "EMP001",
        firstName: "Ravi",
        lastName: "K",
        email: "ravi@talentspotify.com",
        lineManager: "68e49939df33a7c9177aaf03",
        personalInformation: {
            firstName: "Ravi",
            lastName: "K",
            middleName: ""
        },
        contactInformation: {
            workEmail: "ravi@talentspotify.com"
        },
        employmentInformation: {
            employeeNumber: "EMP001"
        }
    } as any,
    {
        _id: "68e49939df33a7c9177aaf03",
        employeeNumber: "MGR001",
        firstName: "Madhavi",
        lastName: "P",
        email: "madhavi@talentspotify.com",
        personalInformation: {
            firstName: "Madhavi",
            lastName: "P",
            middleName: ""
        }
    } as any
];

export const fetchAllEmployees = async (): Promise<Employee[]> => {
    const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY; // Token
    let apiUrl = import.meta.env.VITE_EMPLOYEE_LIST_API_URL;

    if (apiUrl && apiUrl.includes('{company_id}')) {
        apiUrl = apiUrl.replace('{company_id}', getCompanyId());
    }

    if (!apiKey || !apiUrl) {
        console.warn('Employee API key or URL is missing. Returning MOCK employees for simulation.');
        return MOCK_EMPLOYEES;
    }

    try {
        console.log('Fetching employees from:', apiUrl);
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch employees: ${response.statusText}`);
        }

        const data = await response.json();
        // Handle potential response wrappers (data.data, data.users, etc.)
        let employees: Employee[] = [];
        if (Array.isArray(data)) {
            employees = data;
        } else if (data && Array.isArray(data.data)) {
            employees = data.data;
        } else if (data && Array.isArray(data.users)) {
            employees = data.users;
        } else if (data && Array.isArray(data.employees)) {
            employees = data.employees;
        }

        console.log(`Fetched ${employees.length} employees.`);
        return employees;
    } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
};
