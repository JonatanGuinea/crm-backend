
export const success = (res, status = 200, data = null) => {
  return res.status(status).json({ error: null, data })
}

export const fail = (res, status = 500, message = 'Error interno') => {
  return res.status(status).json({ error: message, data: null })
}

export const paginated = (res, data, pagination) => {
  return res.status(200).json({ error: null, data, pagination })
}
