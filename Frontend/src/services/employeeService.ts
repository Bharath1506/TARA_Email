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
    return (new URLSearchParams(window.location.search).get('companyId')) || '6396f7d703546500086f0200';
};

export const fetchAllEmployees = async (): Promise<Employee[]> => {
    const apiKey = import.meta.env.VITE_EMPLOYEE_API_KEY; // Token
    // URL provided by user in env var: https://ai.talentspotifyapp.com/api/employees/getEmployeesAll/6396f7d703546500086f0200
    const apiUrl = import.meta.env.VITE_GET_ALL_EMPLOYEE_API_KEY;

    if (!apiKey) {
        console.warn('Employee API key is missing.');
        return [];
    }

    if (!apiUrl) {
        console.warn('Get All Employees URL (VITE_GET_ALL_EMPLOYEE_API_KEY) is missing.');
        return [];
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
