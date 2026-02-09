export interface EmployeeDetails {
    id: string;
    name: string;
    email: string;
    role: string;
    company: string;
}

export const getEmployeeDetailsFromToken = (): EmployeeDetails | null => {
    const token = import.meta.env.VITE_EMPLOYEE_API_KEY;
    if (!token) return null;

    try {
        const payload = token.split('.')[1];
        if (!payload) return null;

        const decoded = JSON.parse(atob(payload));

        return {
            id: decoded._id || decoded.id,
            name: decoded.name,
            email: decoded.email,
            role: decoded.role,
            company: decoded.company
        };
    } catch (error) {
        console.error('Failed to decode employee token:', error);
        return null;
    }
};
