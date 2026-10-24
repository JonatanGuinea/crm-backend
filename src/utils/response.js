
export const success = (res, status = 200, data = null) => {
  return res.status(status).json({ error: null, data })
}

export const fail = (res, status = 500, message = 'Error interno') => {
  const safeMessage = status === 500 && process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : message
  return res.status(status).json({ error: safeMessage, data: null })
}

export const paginated = (res, data, pagination) => {
  return res.status(200).json({ error: null, data, pagination })
}
