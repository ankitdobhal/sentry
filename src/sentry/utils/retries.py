import functools
import itertools
import logging
import random
import time
from abc import ABC, abstractmethod
from typing import Callable, Generic, TypeVar

from django.utils.encoding import force_bytes

logger = logging.getLogger(__name__)


class RetryException(Exception):
    def __init__(self, message, exception):
        super().__init__(message)
        self.message = message
        self.exception = exception

    def __reduce__(self):
        return RetryException, (self.message, self.exception)

    def __str__(self):
        return force_bytes(self.message, errors="replace")

    def __repr__(self):
        return f"<{type(self).__name__}: {self.message!r}>"


T = TypeVar("T")


class RetryPolicy(Generic[T], ABC):
    @abstractmethod
    def __call__(self, function: Callable[[], T]) -> T:
        raise NotImplementedError

    @classmethod
    def wrap(cls, *args, **kwargs):
        """
        A decorator that may be used to wrap a function to be retried using
        this policy.
        """
        retrier = cls(*args, **kwargs)

        def decorator(fn):
            @functools.wraps(fn)
            def execute_with_retry(*args, **kwargs):
                return retrier(functools.partial(fn, *args, **kwargs))

            return execute_with_retry

        return decorator


class ConditionalRetryPolicy(RetryPolicy[T]):
    """
    A basic policy that can be used to retry a callable based on the result
    of a test function that determines whether or not to retry after the
    callable throws an exception.

    The test function takes two arguments: the number of times the callable
    has unsuccesfully been invoked, and the exception instance that was
    raised during the last execution attempt.
    """

    def __init__(self, test_function: Callable[[int, Exception], bool]) -> None:
        self.__test_function = test_function

    def __call__(self, function: Callable[[], T]) -> T:
        for i in itertools.count(1):
            try:
                return function()
            except Exception as e:
                if not self.__test_function(i, e):
                    raise


class TimedRetryPolicy(RetryPolicy):
    """
    A time-based policy that can be used to retry a callable in the case of
    failure as many times as possible up to the ``timeout`` value (in seconds.)

    The ``delay`` function accepts one argument, a number which represents the
    number of this attempt (starting at 1.)
    """

    def __init__(
        self,
        timeout,
        delay=None,
        exceptions=(Exception,),
        metric_instance=None,
        metric_tags=None,
        log_original_error=False,
    ):
        if delay is None:
            # 100ms +/- 50ms of randomized jitter
            def delay(i):
                return 0.1 + ((random.random() - 0.5) / 10)

        self.timeout = timeout
        self.delay = delay
        self.exceptions = exceptions
        self.clock = time
        self.metric_instance = metric_instance
        self.metric_tags = metric_tags or {}
        self.log_original_error = log_original_error

    def __call__(self, function):
        start = self.clock.time()
        try:
            for i in itertools.count(1):
                try:
                    return function()
                except self.exceptions as error:
                    if self.log_original_error:
                        logger.info(error)
                    delay = self.delay(i)
                    now = self.clock.time()
                    if (now + delay) > (start + self.timeout):
                        raise RetryException(
                            "Could not successfully execute %r within %.3f seconds (%s attempts.)"
                            % (function, now - start, i),
                            error,
                        )
                    else:
                        logger.debug(
                            "Failed to execute %r due to %r on attempt #%s, retrying in %s seconds...",
                            function,
                            error,
                            i,
                            delay,
                        )
                        self.clock.sleep(delay)
        finally:
            if self.metric_instance:
                from sentry.utils import metrics

                metrics.timing(
                    "timedretrypolicy.duration",
                    self.clock.time() - start,
                    instance=self.metric_instance,
                    tags=self.metric_tags,
                )
