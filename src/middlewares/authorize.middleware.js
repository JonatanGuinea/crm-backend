import {fail} from "../utils/response.util.js";

export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if(!req.user || !allowedRoles.includes(req.user.role)){
            return fail(res, 403, 'No autorizado - rol insuficiente')
        }

        next()
    }
}

