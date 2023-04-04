import pytest   # type: ignore

from morphodict.preference import (
    PreferenceConfigurationError,
    all_preferences,
    register_preference,
)   # type: ignore


def test_create_preference_with_incorrect_default():
    """
    Ensure that a preference MUST have a valid default.
    """
    num_prefs_before = len(all_preferences())

    with pytest.raises(PreferenceConfigurationError):

        @register_preference
        class PreferenceWithBadDefault:
            choices = {"coffee": "Coffee", "tea": "Tea"}
            default = "water"

    num_prefs_after = len(all_preferences())
    assert num_prefs_before == num_prefs_after
