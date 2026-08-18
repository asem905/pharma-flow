class AppError extends Error {
    constructor() {
        super();
    }
    createErrorResponse(message, statusCode, statusText) {
        this.message = message;
        this.statusCode = statusCode;
        this.statusText = statusText;
        return this;
    }
}
export default new AppError();