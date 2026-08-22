import logging
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ANSI color codes
_GREEN  = "\033[92m"
_YELLOW = "\033[93m"
_RED    = "\033[91m"
_CYAN   = "\033[96m"
_GREY   = "\033[90m"
_RESET  = "\033[0m"
_BOLD   = "\033[1m"

# Skip noisy paths from terminal output
_SKIP_PATHS = {"/health", "/favicon.ico"}


def _status_color(code: int) -> str:
    if code < 300:
        return _GREEN
    if code < 400:
        return _YELLOW
    return _RED


def _method_color(method: str) -> str:
    return {
        "GET":    _CYAN,
        "POST":   _GREEN,
        "PUT":    _YELLOW,
        "PATCH":  _YELLOW,
        "DELETE": _RED,
    }.get(method, _GREY)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start    = time.perf_counter()
        response = await call_next(request)
        ms       = int((time.perf_counter() - start) * 1000)

        path = request.url.path
        if path in _SKIP_PATHS:
            return response

        method = request.method
        code   = response.status_code
        mc     = _method_color(method)
        sc     = _status_color(code)
        dc     = _GREEN if ms < 300 else _YELLOW if ms < 1000 else _RED

        # Terminal — colored, human-readable
        try:
            print(
                f"{_GREY}>{_RESET} "
                f"{mc}{_BOLD}{method:<7}{_RESET} "
                f"{path} "
                f"{sc}{_BOLD}{code}{_RESET} "
                f"{dc}{ms}ms{_RESET}",
                flush=True,
            )
        except UnicodeEncodeError:
            print(f"> {method:<7} {path} {code} {ms}ms", flush=True)

        # File log — plain text
        logger.info("%s %s %s %sms", method, path, code, ms)
        return response
