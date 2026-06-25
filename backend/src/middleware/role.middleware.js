function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
}

const isSuperAdmin = requireRole('super_admin');
const isAdmin = requireRole('admin', 'super_admin');
const isAnyRole = requireRole('super_admin', 'admin', 'invigilator');

module.exports = { requireRole, isSuperAdmin, isAdmin, isAnyRole };