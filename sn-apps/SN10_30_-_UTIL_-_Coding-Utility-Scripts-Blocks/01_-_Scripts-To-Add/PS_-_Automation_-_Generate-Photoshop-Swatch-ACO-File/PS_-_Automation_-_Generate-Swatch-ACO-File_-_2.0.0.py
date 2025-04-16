#!/usr/bin/env python3
"""
Self-contained Adobe Color Swatch generator.

Adapted from:
    https://github.com/kdybicz/adobe-color-swatch
License: MIT

This script allows you to generate an Adobe .ACO file from a CSV swatch file,
using a graphical file explorer for file selection.
"""

import logging
import sys
import traceback
from enum import Enum, unique
from typing import BinaryIO, NamedTuple, TextIO, List

import tkinter as tk
from tkinter import filedialog

# Set up basic logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
log = logging.getLogger(__name__)


@unique
class ColorSpace(Enum):
    RGB = (0, 'RGB', True)
    HSB = (1, 'HSB', True)
    CMYK = (2, 'CMYK', True)
    PANTONE = (3, 'Pantone matching system', False)
    FOCOLTONE = (4, 'Focoltone colour system', False)
    TRUMATCH = (5, 'Trumatch color', False)
    TOYO = (6, 'Toyo 88 colorfinder 1050', False)
    LAB = (7, 'Lab', False)
    GRAYSCALE = (8, 'Grayscale', True)
    HKS = (10, 'HKS colors', False)

    def __new__(cls, *args):  # type: ignore
        obj = object.__new__(cls)
        obj._value_ = args[0]
        return obj

    def __init__(self, _: int, label: str | None = None, supported: bool | None = False):
        self.label = label
        self.supported = supported

    def __str__(self) -> str:
        return self.label if self.label is not None else 'unknown'


class HexColor(NamedTuple):
    name: str
    color_space: ColorSpace
    color_hex: str


class RawColor(NamedTuple):
    name: str
    color_space: ColorSpace
    component_1: int = 0
    component_2: int = 0
    component_3: int = 0
    component_4: int = 0


class ValidationError(Exception):
    def __init__(self, message: str):
        super().__init__()
        self.message = message

    def __str__(self) -> str:
        return repr(self.message)


def validate_color_space(color_space: ColorSpace) -> None:
    if color_space.supported is False:
        raise ValidationError(f'unsupported color space: {str(color_space)}')


def map_to_hex_color(
    name: str,
    color_space: ColorSpace,
    component_1: int = 0,
    component_2: int = 0,
    component_3: int = 0,
    component_4: int = 0,
) -> HexColor:
    if color_space is ColorSpace.RGB:
        if not (0 <= component_1 <= 65535 and 0 <= component_2 <= 65535 and 0 <= component_3 <= 65535 and component_4 == 0):
            raise ValidationError(f'invalid RGB value: {component_1}, {component_2}, {component_3}, {component_4}')
        return HexColor(name, color_space, f'#{component_1:04X}{component_2:04X}{component_3:04X}')
    if color_space is ColorSpace.HSB:
        if not (0 <= component_1 <= 65535 and 0 <= component_2 <= 65535 and 0 <= component_3 <= 65535 and component_4 == 0):
            raise ValidationError(f'invalid HSB value: {component_1}, {component_2}, {component_3}, {component_4}')
        return HexColor(name, color_space, f'#{component_1:04X}{component_2:04X}{component_3:04X}')
    if color_space is ColorSpace.CMYK:
        if not (0 <= component_1 <= 65535 and 0 <= component_2 <= 65535 and 0 <= component_3 <= 65535 and 0 <= component_4 <= 65535):
            raise ValidationError(f'invalid CMYK value: {component_1}, {component_2}, {component_3}, {component_4}')
        return HexColor(name, color_space, f'#{component_1:04X}{component_2:04X}{component_3:04X}{component_4:04X}')
    if color_space is ColorSpace.GRAYSCALE:
        if not (0 <= component_1 <= 10000 and component_2 == 0 and component_3 == 0 and component_4 == 0):
            raise ValidationError(f'invalid Grayscale value: {component_1}, {component_2}, {component_3}, {component_4}')
        return HexColor(name, color_space, f'#{component_1:04X}')
    raise ValidationError(f'unsupported color space: {str(color_space)}')


def map_to_raw_color(name: str, color_space: ColorSpace, color_hex: str = '') -> RawColor:
    color_hex = color_hex.lstrip('#')
    if len(color_hex.strip()) == 0:
        raise ValidationError(f'unsupported color format: {color_hex}')
    if color_space in [ColorSpace.RGB, ColorSpace.HSB]:
        if len(color_hex) == 6:
            return RawColor(
                name,
                color_space,
                int(color_hex[0:2], 16) * 257,
                int(color_hex[2:4], 16) * 257,
                int(color_hex[4:6], 16) * 257,
            )
        if len(color_hex) == 12:
            return RawColor(
                name,
                color_space,
                int(color_hex[0:4], 16),
                int(color_hex[4:8], 16),
                int(color_hex[8:12], 16),
            )
        raise ValidationError(f'unsupported color format: {color_hex}')
    if color_space is ColorSpace.CMYK:
        if len(color_hex) == 8:
            return RawColor(
                name,
                color_space,
                int(color_hex[0:2], 16) * 257,
                int(color_hex[2:4], 16) * 257,
                int(color_hex[4:6], 16) * 257,
                int(color_hex[6:8], 16) * 257,
            )
        if len(color_hex) == 16:
            return RawColor(
                name,
                color_space,
                int(color_hex[0:4], 16),
                int(color_hex[4:8], 16),
                int(color_hex[8:12], 16),
                int(color_hex[12:16], 16),
            )
        raise ValidationError(f'unsupported color format: {color_hex}')
    if color_space is ColorSpace.GRAYSCALE:
        if len(color_hex) == 2:
            gray = int(color_hex[0:2], 16) * 257
        elif len(color_hex) == 4:
            gray = int(color_hex[0:4], 16)
        else:
            raise ValidationError(f'unsupported color format: {color_hex}')
        if gray > 10000:
            raise ValidationError(f'invalid grayscale value: {color_hex}')
        return RawColor(name, color_space, gray)
    raise ValidationError(f'unsupported color space: {str(color_space)}')


def load_csv_file(file: TextIO) -> List[RawColor]:
    colors = []
    try:
        header = file.readline()
        if header != 'name,space_id,color\n':
            raise ValidationError('Invalid file header')
        color_lines = file.readlines()
        for color_line in color_lines:
            line_elements = color_line.strip().split(',')
            if len(line_elements) != 3:
                raise ValidationError('Color line should contain 3 elements')
            name = line_elements[0]
            if not name.strip():
                raise ValidationError('Color name must be provided')
            color_space_id = int(line_elements[1])
            color_space = ColorSpace(color_space_id)
            color_hex = line_elements[2].strip()
            raw_color = map_to_raw_color(name, color_space, color_hex)
            colors.append(raw_color)
    except ValidationError as err:
        log.info('Error while parsing .csv file: %s', err.message)
    finally:
        file.close()
    return colors


def save_aco_file(colors_data: List[RawColor], file: BinaryIO) -> None:
    try:
        # Version 1
        version = 1
        file.write(version.to_bytes(2, 'big'))
        color_count = len(colors_data)
        file.write(color_count.to_bytes(2, 'big'))
        for color_data in colors_data:
            file.write(color_data.color_space.value.to_bytes(2, 'big'))
            file.write(color_data.component_1.to_bytes(2, 'big'))
            file.write(color_data.component_2.to_bytes(2, 'big'))
            file.write(color_data.component_3.to_bytes(2, 'big'))
            file.write(color_data.component_4.to_bytes(2, 'big'))
        # Version 2
        version = 2
        file.write(version.to_bytes(2, 'big'))
        file.write(color_count.to_bytes(2, 'big'))
        for color_data in colors_data:
            file.write(color_data.color_space.value.to_bytes(2, 'big'))
            file.write(color_data.component_1.to_bytes(2, 'big'))
            file.write(color_data.component_2.to_bytes(2, 'big'))
            file.write(color_data.component_3.to_bytes(2, 'big'))
            file.write(color_data.component_4.to_bytes(2, 'big'))
            name_length = len(color_data.name) + 1  # +1 for the termination character
            file.write(name_length.to_bytes(4, 'big'))
            file.write(color_data.name.encode('utf-16-be'))
            file.write((0).to_bytes(2, 'big'))
    except OSError:
        log.error('Error while saving .aco file')
        log.error(traceback.format_exc())
    finally:
        file.close()


def convert_csv_file_to_aco(input_file: TextIO, output_file: BinaryIO) -> None:
    log.info('Generating "%s" to "%s"', input_file.name, output_file.name)
    colors_data = load_csv_file(input_file)
    save_aco_file(colors_data, output_file)


def main():
    # Initialize Tkinter and hide its main window.
    root = tk.Tk()
    root.withdraw()

    print("Please select the CSV file containing your swatches.")
    csv_file_path = filedialog.askopenfilename(
        title="Select CSV File",
        filetypes=[("CSV Files", "*.csv")]
    )
    if not csv_file_path:
        print("No CSV file selected. Exiting.")
        sys.exit(1)
    print(f"CSV file selected: {csv_file_path}")

    print("Please choose where to save the Adobe Color Swatch (.ACO) file.")
    aco_file_path = filedialog.asksaveasfilename(
        title="Save ACO File",
        defaultextension=".aco",
        filetypes=[("ACO Files", "*.aco")]
    )
    if not aco_file_path:
        print("No save location selected. Exiting.")
        sys.exit(1)
    print(f"ACO file will be saved as: {aco_file_path}")

    try:
        with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
            with open(aco_file_path, 'wb') as aco_file:
                convert_csv_file_to_aco(csv_file, aco_file)
                print(f"ACO file generated and saved to {aco_file_path}.")
    except Exception as e:
        print("An error occurred during conversion:")
        print(str(e))
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
