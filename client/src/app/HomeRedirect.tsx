import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../store'

export default function HomeRedirect() {
    const token = useAppSelector((state) => state.auth.token)

    if (token) {
        return <Navigate to='/lobby' replace />
    }

    return <Navigate to='/login' replace />
}