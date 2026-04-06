from pathlib import Path
from packages.domain.adapters.image_pdf import images_to_pdf


def _create_test_image(path: Path, color: str = "red", size=(100, 100)):
    """Helper to create a real test image file."""
    from PIL import Image
    img = Image.new("RGB", size, color)
    img.save(path)


def test_single_image_to_pdf(tmp_path):
    """Single image should produce a valid PDF."""
    img_path = tmp_path / "test.png"
    _create_test_image(img_path)
    output_path = tmp_path / "output.pdf"

    success, out_path, error = images_to_pdf([str(img_path)], str(output_path))

    assert success is True
    assert error == ""
    assert Path(out_path).exists()


def test_multiple_images_to_pdf(tmp_path):
    """Multiple images should combine into a single PDF."""
    img1 = tmp_path / "page1.png"
    img2 = tmp_path / "page2.png"
    _create_test_image(img1, "red")
    _create_test_image(img2, "blue")
    output_path = tmp_path / "combined.pdf"

    success, out_path, error = images_to_pdf(
        [str(img1), str(img2)], str(output_path)
    )

    assert success is True
    assert error == ""
    assert Path(out_path).exists()


def test_empty_input_list(tmp_path):
    """Empty image list should return an error, not crash."""
    output_path = tmp_path / "output.pdf"

    success, out_path, error = images_to_pdf([], str(output_path))

    assert success is False
    assert "at least one image" in error.lower() or "need at least one image" in error.lower()


def test_missing_image_file(tmp_path):
    """Should return an error when an image file doesn't exist."""
    output_path = tmp_path / "output.pdf"

    success, out_path, error = images_to_pdf(
        [str(tmp_path / "nonexistent.jpg")], str(output_path)
    )

    assert success is False
    assert "Image not found" in error
