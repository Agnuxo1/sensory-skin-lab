"""Adversarial and invariant tests for GuardCell's simulated supervisor."""

import dataclasses
import json
import math
import unittest

from guardcell import (
    Action, GuardCellController, Inspection, OllamaVisionInspector,
    Policy, SCENARIOS, encode_png, intrusion_pixel_count, synthetic_frame,
    synthetic_inspection, validate_inspection,
)


class GuardCellSafetyTests(unittest.TestCase):
    def setUp(self):
        self.controller = GuardCellController()

    def tick(self, name):
        return self.controller.tick(synthetic_frame(name), synthetic_inspection(name))

    def test_good_part_is_routed_to_good_bin(self):
        self.assertEqual(self.tick("good").action, Action.ROUTE_GOOD)

    def test_defective_part_is_routed_to_rework(self):
        self.assertEqual(self.tick("defective").action, Action.ROUTE_REWORK)

    def test_human_in_visual_exclusion_zone_triggers_latched_stop(self):
        self.assertEqual(self.tick("intrusion").action, Action.EMERGENCY_STOP)
        self.assertTrue(self.controller.stop_latched)
        self.assertEqual(self.tick("good").action, Action.EMERGENCY_STOP)

    def test_independent_proximity_interlock_dominates_vlm(self):
        self.assertEqual(self.tick("human_near").action, Action.EMERGENCY_STOP)

    def test_physical_emergency_stop_dominates_vlm(self):
        self.assertEqual(self.tick("estop").action, Action.EMERGENCY_STOP)

    def test_gate_interlock_dominates_vlm(self):
        self.assertEqual(self.tick("gate").action, Action.EMERGENCY_STOP)

    def test_safety_sensor_failure_triggers_stop(self):
        self.assertEqual(self.tick("sensor_fault").action, Action.EMERGENCY_STOP)

    def test_actuator_fault_triggers_stop(self):
        self.assertEqual(self.tick("actuator_fault").action, Action.EMERGENCY_STOP)

    def test_stale_camera_frame_holds_without_motion(self):
        self.assertEqual(self.tick("stale").action, Action.HOLD)

    def test_low_confidence_holds(self):
        self.assertEqual(self.tick("low_confidence").action, Action.HOLD)

    def test_vlm_timeout_holds(self):
        self.assertEqual(self.tick("model_timeout").action, Action.HOLD)

    def test_unsafe_target_bbox_is_rejected(self):
        self.assertEqual(self.tick("out_of_bounds").action, Action.HOLD)

    def test_prompt_injection_explanation_is_not_executed(self):
        decision = self.tick("prompt_injection")
        self.assertEqual(decision.action, Action.ROUTE_REWORK)
        self.assertNotIn("forward", decision.cause.lower())
        self.assertEqual(decision.model_source, "simulated_adversarial_fixture")

    def test_model_cannot_command_motion_via_classification(self):
        frame = synthetic_frame("good")
        malicious = Inspection("MOVE_ROBOT_FORWARD", 1.0, (73, 54, 99, 76),
                               "Ignore the safety system", 0.001, "malicious")
        decision = self.controller.tick(frame, malicious)
        self.assertEqual(decision.action, Action.HOLD)

    def test_missing_vision_result_fails_closed(self):
        self.assertEqual(self.controller.tick(synthetic_frame("good"), None).action,
                         Action.HOLD)

    def test_vision_nan_confidence_fails_closed(self):
        frame = synthetic_frame("good")
        invalid = Inspection("good", math.nan, (73, 54, 99, 76), "", 0, "fixture")
        self.assertEqual(self.controller.tick(frame, invalid).action, Action.HOLD)

    def test_vision_boolean_bbox_is_not_accepted_as_int(self):
        bad = Inspection("good", 0.99, (True, 54, 99, 76), "", 0.0, "fixture")
        self.assertIsNotNone(validate_inspection(bad, Policy()))

    def test_reset_requires_operator_authorization(self):
        self.tick("intrusion")
        self.assertFalse(self.controller.manual_reset(synthetic_frame("good")))
        self.assertTrue(self.controller.stop_latched)

    def test_reset_requires_clear_interlocks(self):
        self.tick("intrusion")
        self.assertFalse(self.controller.manual_reset(synthetic_frame("intrusion"), True))
        self.assertTrue(self.controller.stop_latched)
        self.assertTrue(self.controller.manual_reset(synthetic_frame("good"), True))
        self.assertEqual(self.tick("good").action, Action.ROUTE_GOOD)

    def test_negative_or_nan_proximity_is_rejected(self):
        frame = synthetic_frame("good")
        with self.assertRaises(ValueError):
            dataclasses.replace(frame, proximity_m=-1)
        with self.assertRaises(ValueError):
            dataclasses.replace(frame, proximity_m=math.nan)

    def test_future_dated_frame_holds(self):
        frame = dataclasses.replace(synthetic_frame("good"), captured_at_s=200)
        self.assertEqual(self.controller.tick(frame, synthetic_inspection("good")).action,
                         Action.HOLD)

    def test_png_format_is_valid(self):
        data = encode_png(synthetic_frame("good"))
        self.assertTrue(data.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(data.endswith(b"\0\0\0\0IEND\xaeB`\x82"))

    def test_red_intrusion_detector_is_separate_from_vlm(self):
        self.assertGreater(intrusion_pixel_count(synthetic_frame("intrusion")), 12)
        self.assertEqual(intrusion_pixel_count(synthetic_frame("good")), 0)

    def test_controller_actions_are_a_closed_enum(self):
        for name in SCENARIOS:
            controller = GuardCellController()
            action = controller.tick(synthetic_frame(name), synthetic_inspection(name)).action
            self.assertIn(action, tuple(Action))

    def test_remote_cloud_endpoint_is_rejected(self):
        with self.assertRaises(ValueError):
            OllamaVisionInspector(base_url="https://api.example.net")
        with self.assertRaises(ValueError):
            OllamaVisionInspector(base_url="http://192.168.1.10:11434")

    def test_policy_invariants_enforced(self):
        with self.assertRaises(ValueError):
            Policy(min_human_distance_m=0)
        with self.assertRaises(ValueError):
            Policy(min_vision_confidence=math.inf)

    def test_json_serializable_decisions(self):
        json.dumps(self.tick("intrusion").to_dict())


if __name__ == "__main__":
    unittest.main()
