const {
  parseExpenseInput,
  getExpensesDB,
  addExpenseDB,
  updateExpenseDB,
  deleteExpenseDB,
  isValidDate,
} = require("../services/expenses.service");

const fail = (req, res, error) => {
  console.error(error);
  return res.status(500).json({ success: false, message: req.__("something_went_wrong_try_later") });
};

exports.getExpenses = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!isValidDate(from) || !isValidDate(to)) {
      return res.status(400).json({ success: false, message: "from and to must be YYYY-MM-DD" });
    }
    return res.status(200).json(await getExpensesDB(req.user.tenant_id, from, to));
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.addExpense = async (req, res) => {
  try {
    const { error, data } = parseExpenseInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const id = await addExpenseDB(req.user.tenant_id, data, req.user.username);
    return res.status(200).json({ success: true, id, message: "Expense saved" });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { error, data } = parseExpenseInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const ok = await updateExpenseDB(Number(req.params.id), req.user.tenant_id, data);
    if (!ok) return res.status(404).json({ success: false, message: "Expense not found" });
    return res.status(200).json({ success: true, message: "Expense saved" });
  } catch (error) {
    return fail(req, res, error);
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const ok = await deleteExpenseDB(Number(req.params.id), req.user.tenant_id);
    if (!ok) return res.status(404).json({ success: false, message: "Expense not found" });
    return res.status(200).json({ success: true, message: "Expense deleted" });
  } catch (error) {
    return fail(req, res, error);
  }
};
